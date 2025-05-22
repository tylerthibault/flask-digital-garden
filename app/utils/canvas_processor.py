"""
Canvas Processor Module

This module handles parsing and processing of Obsidian canvas files (.canvas)
for web rendering. It extracts nodes, connections, and metadata from the
canvas JSON and prepares it for display in the web application.
"""

import json
import os
import re
from flask import current_app, url_for


def load_canvas_file(file_path):
    """
    Load and parse a canvas file from the Obsidian vault.
    
    Args:
        file_path (str): Relative path to the canvas file from the vault root
        
    Returns:
        dict: Parsed canvas data or None if file couldn't be loaded
    """
    full_path = os.path.join(current_app.config['OBSIDIAN_VAULT_PATH'], file_path)
    try:
        with open(full_path, 'r', encoding='utf-8') as f:
            canvas_data = json.load(f)
        return canvas_data
    except (json.JSONDecodeError, FileNotFoundError, PermissionError) as e:
        current_app.logger.error(f"Error loading canvas file {file_path}: {str(e)}")
        return None


def process_wikilinks_in_text(text):
    """
    Convert Obsidian-style wikilinks in text to standard HTML links.
    
    Args:
        text (str): The text containing wikilinks [[Page Name]]
        
    Returns:
        str: Text with wikilinks converted to HTML links
    """
    from app.models import Page
    
    def replace_wikilink(match):
        link_text = match.group(1)
        
        # Check if link uses the pipe syntax for custom text: [[actual-page|display text]]
        if '|' in link_text:
            page_name, display_text = link_text.split('|', 1)
        else:
            page_name = display_text = link_text
        
        # Find the corresponding page in the database
        page = Page.query.filter(
            Page.title.ilike(page_name) | 
            Page.file_path.ilike(f"%{page_name}.md")
        ).first()
        
        if page and page.is_published:
            return f'<a href="/page/{page.id}">{display_text}</a>'
        else:
            # Link doesn't exist or isn't published, just return the text
            return display_text
    
    # Replace [[wikilinks]] with HTML links
    pattern = r'\[\[(.*?)\]\]'
    return re.sub(pattern, replace_wikilink, text)


def process_colored_text(content):
    """
    Process custom color highlighting syntax ={color}text= into HTML spans
    with appropriate styling attributes.
    
    Example: 
        Input: "This is a ={yellow}highlighted= text"
        Output: "This is a <span data-highlight-color="yellow">highlighted</span> text"
    
    Args:
        content (str): Text content that may contain color highlighting syntax
        
    Returns:
        str: Processed content with HTML spans for highlighted text
    """
    # Regular expression to match ={color}text= pattern
    pattern = r'=\{([a-zA-Z]+)\}(.*?)='
    
    def replace_colored_text(match):
        color = match.group(1).lower()  # Get the color name
        text = match.group(2)  # Get the text to color
        
        # We'll let the client-side CSS handle the actual colors
        # Just create spans with data attributes that CSS can target
        return f'<span data-highlight-color="{color}">{text}</span>'
    
    # Replace all matches in the content
    return re.sub(pattern, replace_colored_text, content)


def process_canvas(canvas_data, page_id):
    """
    Process canvas data into a format suitable for web rendering.
    
    This function takes the raw JSON data from a canvas file and transforms it
    into a structure that can be easily rendered by the web frontend. It processes
    nodes (cards/elements) and edges (connections between nodes).
    
    Args:
        canvas_data (dict): Raw canvas JSON data
        page_id (int): ID of the page in the database
        
    Returns:
        dict: Processed canvas data with HTML-friendly structure
    """
    if not canvas_data:
        return {'error': 'Canvas data could not be loaded'}
    
    # Extract basic canvas metadata
    processed = {
        'nodes': [],
        'edges': [],
        'metadata': {
            'name': canvas_data.get('name', 'Unnamed Canvas'),
            'version': canvas_data.get('version', 'Unknown'),
        }
    }
    
    # Process nodes (cards/elements in the canvas)
    for node in canvas_data.get('nodes', []):
        processed_node = {
            'id': node.get('id', ''),
            'type': node.get('type', 'text'),
            'position': {
                'x': node.get('x', 0),
                'y': node.get('y', 0),
            },
            'width': node.get('width', 200),
            'height': node.get('height', 100),
        }
        
        # Handle different node types
        if node.get('type') == 'text':
            # Get original text content
            text_content = node.get('text', '')
            
            # Process special syntax in this order:
            # 1. Process color highlighting
            processed_text = process_colored_text(text_content)
            # 2. Process wikilinks
            processed_text = process_wikilinks_in_text(processed_text)
            
            # Store the processed text
            processed_node['content'] = processed_text
            
        elif node.get('type') == 'file':
            # Link to the file if it exists in our system
            from app.models import Page
            file_path = node.get('file', '')
            related_page = Page.query.filter_by(file_path=file_path).first()
            
            processed_node['file'] = file_path
            processed_node['label'] = node.get('label', os.path.basename(file_path))
            
            if related_page and related_page.is_published:
                processed_node['url'] = url_for('main.view_page', page_id=related_page.id)
                
                # If it's a markdown file, try to add a preview
                if file_path.endswith('.md'):
                    try:
                        full_path = os.path.join(current_app.config['OBSIDIAN_VAULT_PATH'], file_path)
                        with open(full_path, 'r', encoding='utf-8') as f:
                            # Get first 200 characters as preview
                            preview = f.read(200)
                            if len(preview) == 200:
                                preview += "..."
                            
                            # Process the preview text as well
                            preview = process_colored_text(preview)
                            preview = process_wikilinks_in_text(preview)
                            processed_node['preview'] = preview
                    except Exception as e:
                        current_app.logger.error(f"Error creating preview for {file_path}: {str(e)}")
                        
        elif node.get('type') == 'link':
            processed_node['url'] = node.get('url', '')
            processed_node['label'] = node.get('label', node.get('url', 'Link'))
        
        processed['nodes'].append(processed_node)
    
    # Process edges (connections between nodes)
    for edge in canvas_data.get('edges', []):
        processed_edge = {
            'id': edge.get('id', ''),
            'fromNode': edge.get('fromNode', ''),
            'toNode': edge.get('toNode', ''),
            'label': edge.get('label', ''),
            'color': edge.get('color', '#666666'),
        }
        processed['edges'].append(processed_edge)
    
    return processed