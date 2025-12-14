import mysql.connector
import os

# Load DB config from environment variables or .env file
DB_HOST = os.getenv('DB_HOST', '127.0.0.1')
DB_PORT = int(os.getenv('DB_PORT', 3306))
DB_DATABASE = os.getenv('DB_DATABASE', 'job_portal')
DB_USERNAME = os.getenv('DB_USERNAME', 'root')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')

print('Connecting to database...')
conn = mysql.connector.connect(
    host=DB_HOST,
    port=DB_PORT,
    user=DB_USERNAME,
    password=DB_PASSWORD,
    database=DB_DATABASE
)
cursor = conn.cursor()

print('Checking database tables...')
cursor.execute('SHOW TABLES')
tables = cursor.fetchall()
for (table_name,) in tables:
    if 'job' in table_name:
        print(f'Found: {table_name}')

print('\nChecking jobs table structure...')
cursor.execute('DESC jobs')
columns = cursor.fetchall()
for col in columns:
    print(f'  - {col[0]} ({col[1]})')

cursor.close()
conn.close()
