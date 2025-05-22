import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-key-please-change-in-production'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///digital_garden.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    OBSIDIAN_VAULT_PATH = os.environ.get('OBSIDIAN_VAULT_PATH') or r'\\painestorage\Engineering\Manufacturing Engineering\Software Docs'
    UPLOAD_FOLDER = os.path.join('app', 'static', 'uploads')