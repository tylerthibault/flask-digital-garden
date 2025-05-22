import re
import os
from flask import current_app

def process_markdown(content):
    """
    Process Obsidian-specific markdown features into standard markdown
    or HTML that can be properly rendered
    """
    # Process custom color highlighting
    content = process_colored_text(content)
    
    # Process wikilinks [[Page Name]] -> [Page Name](page_url)
    content = process_wikilinks(content)
    
    # Process embeds ![[Embed]] -> appropriate content or link
    content = process_embeds(content)
    
    return content

def process_colored_text(content):
    """
    Process custom color highlighting syntax ={color}text= into HTML spans with appropriate styling.
    
    Example: ={yellow}Datapoint= becomes <span style="background-color: yellow;">Datapoint</span>
    """
    # Regular expression to match ={color}text= pattern
    pattern = r'=\{([a-zA-Z]+)\}(.*?)='
    
    def replace_colored_text(match):
        color = match.group(1).lower()  # Get the color name
        text = match.group(2)  # Get the text to color
        
        # Map color names to CSS values if needed
        color_map = {
            'yellow': "#f5f55e",
            'red': '#ffcccc',
            'green': '#ccffcc',
            'blue': '#ccccff',
            # Add more colors as needed
        }
        
        # Get the actual color value or default to the name if not in map
        css_color = color_map.get(color, color)
        
        # Create HTML span with appropriate styling
        return f'<span style="background-color: {css_color};">{text}</span>'
    
    # Replace all matches in the content
    return re.sub(pattern, replace_colored_text, content)

def process_wikilinks(content):
    """Convert Obsidian wikilinks to standard markdown links"""
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
            return f'[{display_text}](/page/{page.id})'
        else:
            # Link doesn't exist or isn't published, just return the text
            return display_text
    
    # Replace [[wikilinks]] with Markdown links
    pattern = r'\[\[(.*?)\]\]'
    return re.sub(pattern, replace_wikilink, content)

def process_embeds(content):
    """Handle Obsidian embeds like ![[image.png]] or ![[note]]"""
    def replace_embed(match):
        embed_link = match.group(1)
        
        # Handle image embeds
        if any(embed_link.lower().endswith(ext) for ext in ['.png', '.jpg', '.jpeg', '.gif', '.svg']):
            # Construct the path to the embedded file
            embed_path = os.path.join(current_app.config['OBSIDIAN_VAULT_PATH'], embed_link)
            
            # For images, use standard markdown image syntax
            if os.path.exists(embed_path):
                # This assumes you have a route to serve vault files
                return f'![{embed_link}](/vault_file/{embed_link})'
            else:
                return f'[Image not found: {embed_link}]'
        
        # Handle note embeds (similar to wikilinks but with content included)
        # This is a simplified implementation - full Obsidian behavior would be more complex
        from app.models import Page
        
        # Find the corresponding page in the database
        page = Page.query.filter(
            Page.title.ilike(embed_link) | 
            Page.file_path.ilike(f"%{embed_link}.md")
        ).first()
        
        if page and page.is_published:
            try:
                file_path = os.path.join(current_app.config['OBSIDIAN_VAULT_PATH'], page.file_path)
                with open(file_path, 'r', encoding='utf-8') as f:
                    embed_content = f.read()
                
                # Add a blockquote formatting to distinguish embedded content
                embed_content = '\n> ' + '\n> '.join(embed_content.split('\n'))
                return f'**Embedded from [{page.title}](/page/{page.id}):**\n{embed_content}\n'
            except:
                return f'[Could not embed: {embed_link}](/page/{page.id})'
        else:
            # Link doesn't exist or isn't published
            return f'[Content not available: {embed_link}]'
    
    # Replace ![[embeds]] with appropriate content
    pattern = r'!\[\[(.*?)\]\]'
    return re.sub(pattern, replace_embed, content)