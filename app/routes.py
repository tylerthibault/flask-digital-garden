from flask import Blueprint, render_template, abort, redirect, url_for, request, current_app, flash, jsonify
from app.models import Page, db
from app.utils.markdown_processor import process_markdown
from app.utils.canvas_processor import load_canvas_file, process_canvas
import os
import markdown
from datetime import datetime
import json

main_bp = Blueprint('main', __name__)
admin_bp = Blueprint('admin', __name__)

@main_bp.route('/')
def index():
    """Public homepage showing published pages"""
    pages = Page.query.filter_by(is_published=True).order_by(Page.published_at.desc()).all()
    return render_template('public/index.html', pages=pages)

@main_bp.route('/page/<int:page_id>')
def view_page(page_id):
    """View a published page"""
    page = Page.query.get_or_404(page_id)
    
    if not page.is_published:
        abort(404)
    
    # Handle different file types
    if page.file_type == 'canvas':
        # Load and process canvas file
        canvas_data = load_canvas_file(page.file_path)
        processed_canvas = process_canvas(canvas_data, page_id)
        return render_template('public/canvas.html', page=page, canvas=processed_canvas)
    else:
        # Handle markdown files (default)
        try:
            file_path = os.path.join(current_app.config['OBSIDIAN_VAULT_PATH'], page.file_path)
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Process and convert markdown to HTML
            processed_content = process_markdown(content)
            html_content = markdown.markdown(
                processed_content,
                extensions=['extra', 'codehilite', 'fenced_code']
            )
            
            return render_template('public/page.html', page=page, content=html_content)
        except Exception as e:
            current_app.logger.error(f"Error rendering page {page_id}: {str(e)}")
            abort(500)

# Admin routes for managing published pages
@admin_bp.route('/')
def admin_index():
    """Admin dashboard"""
    pages = Page.query.order_by(Page.last_modified.desc()).all()
    return render_template('admin/index.html', pages=pages)

@admin_bp.route('/scan')
def scan_vault():
    """Scan the Obsidian vault for new or modified files"""
    vault_path = current_app.config['OBSIDIAN_VAULT_PATH']
    
    # Track number of new files found
    new_files = 0
    
    for root, _, files in os.walk(vault_path):
        for file in files:
            # Check for markdown and canvas files
            if file.endswith('.md') or file.endswith('.canvas'):
                # Get relative path from vault root
                rel_path = os.path.relpath(os.path.join(root, file), vault_path)
                
                # Check if this file is already in the database
                existing_page = Page.query.filter_by(file_path=rel_path).first()
                
                if not existing_page:
                    # Determine file type
                    file_type = 'canvas' if file.endswith('.canvas') else 'markdown'
                    
                    # Extract title 
                    if file_type == 'markdown':
                        # For markdown, try to get title from first heading
                        file_path = os.path.join(root, file)
                        try:
                            with open(file_path, 'r', encoding='utf-8') as f:
                                first_line = f.readline().strip()
                                title = first_line.lstrip('#').strip() if first_line.startswith('#') else os.path.splitext(file)[0]
                        except:
                            title = os.path.splitext(file)[0]
                    else:
                        # For canvas files, extract title from JSON if possible
                        file_path = os.path.join(root, file)
                        try:
                            with open(file_path, 'r', encoding='utf-8') as f:
                                canvas_data = json.load(f)
                                title = canvas_data.get('name', os.path.splitext(file)[0])
                        except:
                            title = os.path.splitext(file)[0]
                    
                    # Create new page record
                    new_page = Page(
                        title=title,
                        file_path=rel_path,
                        file_type=file_type,
                        is_published=False,
                        last_modified=datetime.utcnow()
                    )
                    db.session.add(new_page)
                    new_files += 1
    
    if new_files > 0:
        db.session.commit()
        flash(f'Found {new_files} new files in the vault', 'success')
    else:
        flash('No new files found', 'info')
    
    return redirect(url_for('admin.admin_index'))

@admin_bp.route('/publish/<int:page_id>', methods=['POST'])
def toggle_publish(page_id):
    """Toggle the published status of a page"""
    page = Page.query.get_or_404(page_id)
    
    if page.is_published:
        page.unpublish()
        flash(f'"{page.title}" has been unpublished', 'info')
    else:
        page.publish()
        flash(f'"{page.title}" has been published successfully', 'success')
    
    db.session.commit()
    return redirect(url_for('admin.admin_index'))