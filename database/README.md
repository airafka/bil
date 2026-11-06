# Перенос bil-next на другой компьютер

Переносимый снимок от05.11 (исторический): `billing-next-snapshot.dump`, 05.11.2026, PostgreSQL16, схемаV26. Содержит схему, все данные приложения, последовательности номеров и историю Flyway. Контрольная сумма SHA256 и результаты проверки: [billing-next-snapshot.json](billing-next-snapshot.json).

Снимок переносит данные на момент экспорта. Дальнейшая работа на компьютерах автоматически не синхронизируется. Настройки подключения и роли PostgreSQL не переносятся; Docker Compose создаёт локального пользователя по `.env`.

## Windows: развёртывание с данными

Нужны Git, Docker Desktop с Linux containers и Docker Compose v2. Java, Node.js и PostgreSQL на компьютере устанавливать отдельно не требуется. Запустите Docker Desktop. Порты3001/8081/5433 должны быть свободны.

```powershell
git clone --branch bil-next --single-branch https://github.com/airafka/bil.git bil-next
cd bil-next
Copy-Item .env.example .env
powershell -NoProfile -ExecutionPolicy Bypass -File .\restore-snapshot.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\start.ps1
```

Выполняйте команды последовательно: после ошибки не переходите к следующей. **Сначала восстановите снимок, затем запускайте приложение.** Иначе Flyway создаст таблицы и скрипт импорта откажется их заменять.

`restore-snapshot.ps1` проверяет SHA256, отказывается работать при запущенных backend/frontend, запускает только db и восстанавливает снимок одной транзакцией исключительно в пустую `billing_next`. Существующие таблицы и данные он не удаляет. Повторное восстановление в уже заполненную БД завершается отказом. Если на компьютере уже есть проект billing-next с нужными данными, используйте отдельное окружение; не удаляйте его volume для повторения инструкции.

Скрипты находят Docker через PATH или стандартные пути установки; имя пользователя Windows и расположение клона могут быть любыми. При занятом порте измените `FRONTEND_PORT`, `BACKEND_PORT`, `DB_PORT` в `.env` перед восстановлением. Имя БД оставьте `billing_next`. Локальный пароль можно изменить в `.env` до первого создания volume; файл `.env` не публикуется.

## Проверка запуска

- Интерфейс: http://localhost:3001
- Backend health: http://localhost:8081/actuator/health — после запуска ожидается `UP`.
- Контейнеры: `docker compose -p billing-next ps`.
- Остановка: `.\stop.ps1`; последующие запуски: `.\start.ps1`. Они сохраняют БД и не восстанавливают снимок автоматически.

Первый запуск собирает приложения и может занять несколько минут. Compose использует отдельные сеть `billing-next_default` и volume `billing-next_postgres-data`. С исходным проектом `billing` на портах3000/8080/5432 он не смешивается.

## Linux / macOS

После клонирования ветки bil-next скопируйте `.env.example` в `.env`. В **новом пустом окружении**, до запуска backend/frontend:

```sh
docker compose -p billing-next up -d --wait db
docker compose -p billing-next exec -T db psql -X -U billing -d billing_next -At -c "select count(*) from pg_tables where schemaname='public';"
# Продолжать только если результат 0. При существующих таблицах остановиться.
docker compose -p billing-next cp database/billing-next-snapshot.dump db:/tmp/billing-next-snapshot.dump
docker compose -p billing-next exec -T db pg_restore -U billing -d billing_next --no-owner --no-acl --single-transaction --exit-on-error /tmp/billing-next-snapshot.dump
# Только после успешного восстановления:
docker compose -p billing-next up -d --build
```

Параметр `-U billing` соответствует `.env.example`; при смене POSTGRES_USER укажите выбранное имя. Не используйте `--clean` и не запускайте исторические seed/cleanup/renumber-скрипты.

## Старые снимки

`billing-snapshot.dump` от29.10.2026 — историческая версия V1–V44, несовместимая с текущей схемой. Для этого переноса не использовать. Локальный `billing-next-initial.dump` от04.11.2026 также не является актуальным снимком и не публикуется. Используйте только `billing-next-snapshot.dump` вместе с кодом ветки bil-next.

## Изменение рабочей базы 06.11.2026

Рабочая версия перешла на V27 и ручные возвраты; заявки и расчёты очищены по отдельному запросу. Опубликованный снимок V26 от05.11 не заменялся и по-прежнему содержит прежние заявки. При запуске нового кода миграция V27 обновит его схему, но **не выполнит очистку автоматически**. Для развёртывания текущих данных потребуется отдельный свежий экспорт по запросу. Локальные резервные копии перед очисткой не публикуются; см. HANDOFF.md.
