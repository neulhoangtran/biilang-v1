#!/bin/bash

# Định nghĩa biến
BACKUP_DIR="./backup"
CONTAINER_NAME="strapiDB"
DATABASE_NAME="strapi"
DATABASE_USER="app"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"

# Tạo thư mục backup nếu chưa có
mkdir -p $BACKUP_DIR

# Xuất khẩu biến mật khẩu để không cần nhập tay
export PGPASSWORD="your_database_password"

# Chạy backup trực tiếp vào máy host thay vì container
docker exec $CONTAINER_NAME pg_dump -U $DATABASE_USER -d $DATABASE_NAME -F c > $BACKUP_FILE

if [ $? -eq 0 ]; then
    echo "✅ Backup thành công: $BACKUP_FILE"
else
    echo "❌ Lỗi backup database!"
fi