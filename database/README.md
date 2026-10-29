# Перенос текущих данных MVP

`billing-snapshot.dump` — полный снимок локальной PostgreSQL 16 от 29 октября 2026 года: схема, данные, последовательности номеров и история Flyway. Включает клиентов, договоры, КТК, услуги, тарифы, заявки, накладные, рейсы и начисления. Это разовая копия; дальнейшая работа на устройствах автоматически не синхронизируется.

Снимок проверен восстановлением в отдельную базу. В нём 9 заявок на услугу, 17 поставок, 15 вывозов, 9 накладных и 10 начислений.

## Восстановление на другом устройстве

Открой терминал в корне проекта, где находится `compose.yaml`. Команды подходят для стандартных настроек проекта (база и пользователь `billing`). При изменённых `POSTGRES_DB` / `POSTGRES_USER` в `.env` подставь свои значения в параметры `-d` / `-U`.

**Восстановление заменяет текущие данные базы на этом устройстве данными из снимка.** Если там уже есть нужные данные, сначала сохрани их по инструкции ниже.

```sh
git pull --ff-only origin main
docker compose stop backend frontend
docker compose up -d --wait db
docker compose cp database/billing-snapshot.dump db:/tmp/billing-snapshot.dump
docker compose exec -T db pg_restore -U billing -d billing --clean --if-exists --no-owner --no-acl --single-transaction --exit-on-error /tmp/billing-snapshot.dump
docker compose up -d --build --wait
```

Выполняй команды последовательно. Если восстановление сообщило об ошибке, не переходи к запуску приложения: транзакция восстановления откатится. Не удаляй Docker volume.

После запуска открой http://localhost:3000. Восстановленные данные и номера заявок должны отображаться сразу. Flyway использует историю из снимка, поэтому повторно начальные данные не добавляет.

Проверка количества записей:

```sh
docker compose exec -T db psql -U billing -d billing -c "select (select count(*) from service_order) as services, (select count(*) from receiving_order) as receiving, (select count(*) from shipping_order) as shipping, (select count(*) from waybill) as waybills, (select count(*) from billing_charge) as charges;"
```

Ожидаемый результат: `9 | 17 | 15 | 9 | 10`.

## Сохранить данные второго устройства перед заменой

После остановки backend/frontend и запуска db, но **до** команды `pg_restore`:

```sh
docker compose exec -T db pg_dump -U billing -d billing --format=custom --no-owner --no-acl --file=/tmp/before-import.dump
docker compose cp db:/tmp/before-import.dump ./before-import.dump
```

Убедись, что файл `before-import.dump` появился на компьютере. Он исключён из Git. При необходимости его можно восстановить тем же способом, заменив путь к исходному снимку.
