# app-vikof

# normal deploy
cd /var/www/billang; git pull origin master; docker compose up -d --build --no-deps strapi
docker logs -f strapi

#deploy app with all clean
cd /var/www/html/vikof
docker compose build --no-cache strapi
docker compose up -d --no-deps strapi

# database 
docker exec -it strapiDB bash

sh restore.sh
docker exec -it strapiDB sh
pg_restore --clean --if-exists -U app -d strapi /tmp/restore.sql



# Các step deploy app 
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios --profile production
# build lại
sửa "buildNumber": "4", trong app.json
eas build --platform ios --profile production
eas submit --platform ios --profile production --latest

# tạo .env
eas env:create --environment production --name EXPO_PUBLIC_API_BASE_URL --value http://45.251.114.21:1337
eas env:create --environment production --name EXPO_PUBLIC_API_TOKEN --value xxx

# chỉ update 
eas update --environment production --branch production --message "Update app" 



git add . ; git commit -m "update"; git push origin master

docker exec -it strapi sh -c "tail -n 200 /opt/app/logs/cron/sms-cron/sms-cron-$(date +%F).log"

mkdir -p ./backend/logs/cron
mkdir -p ./backend/logs/system

chmod -R 777 ./backend/logs

npx expo login


rm -rf .cache build dist node_modules/.cache node_modules package-lock.json yarn.lock pnpm-lock.yaml

## dọn dẹp trước khi build 
cd /var/www/billang

docker compose stop strapi
docker compose rm -f strapi
docker compose build --no-cache --pull strapi
docker compose up -d --no-deps --force-recreate strapi