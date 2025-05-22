from app import db
from datetime import datetime

class Page(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    file_path = db.Column(db.String(500), nullable=False, unique=True)
    file_type = db.Column(db.String(20), default='markdown')  # New field for file type
    is_published = db.Column(db.Boolean, default=False)
    published_at = db.Column(db.DateTime, nullable=True)
    last_modified = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Page {self.title}>'
    
    def publish(self):
        self.is_published = True
        self.published_at = datetime.utcnow()
        
    def unpublish(self):
        self.is_published = False
        self.published_at = None