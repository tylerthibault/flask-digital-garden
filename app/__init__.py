from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from config import Config  # Make sure this import works correctly

db = SQLAlchemy()
migrate = Migrate()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Debug: Print the database URI to verify it's loaded
    print(f"Database URI: {app.config.get('SQLALCHEMY_DATABASE_URI')}")
    
    db.init_app(app)
    migrate.init_app(app, db)
    
    # Import blueprints here to avoid circular imports
    from app.routes import main_bp, admin_bp
    app.register_blueprint(main_bp)
    app.register_blueprint(admin_bp, url_prefix='/admin')
    
    # Create database tables if they don't exist
    with app.app_context():
        db.create_all()
    
    return app