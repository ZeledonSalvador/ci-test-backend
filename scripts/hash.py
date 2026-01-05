import bcrypt # type: ignore
from datetime import datetime

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

users = [
    ('*', '*', 'admin'),
    ('*', '*', 'bot'),
    ('*', '*', 'bot')
]

current_time_sql = "GETDATE()"
sql = "INSERT INTO Users (username, password, role, created_at, updated_at)\nVALUES\n"
insert_lines = []
for username, password, role in users:
    hashed_password = hash_password(password)
    insert_line = f"    ('{username}', '{hashed_password}', '{role}', {current_time_sql}, {current_time_sql})"
    insert_lines.append(insert_line)

sql += ",\n".join(insert_lines) + ";"
print(sql)
