#!/bin/bash

# Định nghĩa biến
BACKUP_DIR="./backup"
CONTAINER_NAME="strapiDB"
DATABASE_NAME="strapi"
DATABASE_USER="biilang"

# Tìm file backup mới nhất
LATEST_BACKUP=$(ls -t $BACKUP_DIR | head -n 1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ Không tìm thấy file backup nào!"
    exit 1
fi

echo "🔄 Đang khôi phục từ file: $LATEST_BACKUP"

# Sao chép file vào container
docker cp $BACKUP_DIR/$LATEST_BACKUP $CONTAINER_NAME:/tmp/restore.sql

# Thực hiện khôi phục
#docker exec -t $CONTAINER_NAME pg_restore -U $DATABASE_USER -d $DATABASE_NAME /tmp/restore.sql

#docker exec -i strapiDB pg_restore --clean --if-exists -U biilang -d strapi < /tmp/restore.sql
echo "✅ copy thành công vào $LATEST_BACKUP"
