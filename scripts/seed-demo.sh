#!/bin/bash
echo '🌱 Seeding IntelliTraffic AI Demo Data...'
cd "$(dirname "$0")/../backend"
source venv/bin/activate
python -c "
from app.database.database import SessionLocal
from app.database.seed import seed_database
db = SessionLocal()
try:
    seed_database(db)
    print('✅ Demo data seeded successfully!')
finally:
    db.close()
"
