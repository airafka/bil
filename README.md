# Актуальное поведение: брутто и перенос груза (27 октября 2026)

В waybill_container хранится только gross_weight (брутто), кроме идентификаторов и связей. tare_weight есть только в справочнике container; net_weight не хранится. API накладной и поставки возвращает тару из справочника и расчётное netWeight = gross_weight - container.tare_weight. Правка тары влияет на расчёт существующих накладных; значение выше брутто существующей накладной отклоняется.

Автовывозы, созданные на основании ЖД-поставки в заявке на услугу, получают ЕТСНГ своего КТК и рассчитанную массу. При нулевой массе создаётся порожний КТК без груза. Масса сохраняется в shipping_order_container_item при создании вывоза. Одинаковые повторные КТК дают один вывоз; разные грузы или брутто для одного КТК в выбранных накладных возвращают CONFLICTING_CONTAINER_CARGO с откатом всей операции.

Новых версионных миграций не добавлялось: исправлено базовое определение V5 и локальная схема пересоздана с восстановлением всех текущих записей, кроме удаляемых полей тары/нетто накладной. Перед этим сохранена полная копия БД и исходников в ChatGPT/Билинг/backups/before-live-tare-cargo-2026-10-27.

---

# Актуальное изменение: массы КТК (27 октября 2026)

Все массы в нашем MVP задаются в килограммах, с точностью до 0,001 кг. В справочнике КТК хранится tare_weight, исходно 3200 кг для всех КТК по запросу пользователя. Раздел «Справочник КТК» позволяет изменить тару. API: PATCH /api/references/containers/{id}/tare-weight с {"tareWeight":"3200.000"}.

Создание накладной: на вкладке КТК вводится брутто каждого контейнера, тара подставляется из справочника, масса груза вычисляется автоматически. На вкладке Груз выбирается ЕТСНГ для каждого гружёного КТК. Брутто, равное таре, означает порожний КТК без груза. Брутто меньше тары отклоняется.

Новый состав запроса POST /api/waybills: railwayCarriages: [{railwayCarriageId, containers: [{containerId, grossWeight, etsngCodeId}]}]. Прежние containerIds и самостоятельный список products заменены составом по КТК. Входные tareWeight/netWeight не используются: сервер берёт тару из справочника, масса груза рассчитывается при чтении как gross_weight - container.tare_weight. Тара читается из справочника; в накладной сохраняется только брутто. Масса груза в выдаче products получается из соответствующего КТК, отдельного ввода массы груза нет.

По разрешению пользователя все прежние заявки и накладные удаляются, справочники, клиенты и договоры сохраняются. Новая миграция не добавлялась: изменены исходные определения таблиц в V2 и V5, локальная схема пересоздана и справочники восстановлены из копии. Старую БД с прежними checksum нельзя запускать с этой редакцией исходников без такого пересоздания. Резервная копия до изменений: ChatGPT/Билинг/backups/before-container-weights-2026-10-27 (database.dump и reference-data.sql).

Проверка: node scripts/waybill-mass-smoke-test.mjs с BASE_URL отдельного тестового стека. Проверяет точность, защиту от подмены тары/нетто, ошибочные массы, откат, пересчёт накладной по текущей таре справочника и новый процесс услуги.

---

# Биллинг 2.0

## Счета на оплату

Раздел `/payment-invoices` содержит реестр черновиков. При создании (`/payment-invoices/new`) выбираются клиент, его договор и месяц/год оказания. Затем показываются доступные начисления отдельными строками, как в «Оказанных услугах»: дата, заявка на услугу, КТК, наименование из справочника, суммы без НДС и с НДС. Начисления одного КТК не объединяются. Выбор всех охватывает весь результат фильтра, выбор сохраняется между страницами; изменение фильтра сбрасывает выбор. Один черновик включает до 10 000 строк.

Период определяется по `billing_charge.performed_at` в часовом поясе `app.billing.time-zone` (по умолчанию `Europe/Moscow`): от начала выбранного месяца включительно до начала следующего исключительно. Суммы берутся с сервера из начислений, а не из запроса браузера. В счёте сохраняются снимки названий клиента, договора, услуг и КТК, дат и сумм; новые услуги сами в него не добавляются. Это версия с созданием, просмотром и удалением черновика; выпуск окончательного документа, печатная форма и оплата пока не реализованы.

Миграция V38 добавляет `payment_invoice` и `payment_invoice_line`. Уникальность `billing_charge_id` резервирует начисление только за одним черновиком. Создание выполняется транзакционно с блокировкой начислений и повторной проверкой фильтров/доступности; повтор запроса с тем же `requestKey` возвращает прежний документ. Удаление черновика освобождает начисления без удаления самих оказанных услуг.

API: `GET /api/payment-invoices?page=0&size=20`, `GET /api/payment-invoices/available-charges?clientId=UUID&contractId=UUID&period=2026-05`, `POST /api/payment-invoices` с `{clientId, contractId, period, chargeIds, requestKey}`, `GET /api/payment-invoices/{id}`, `DELETE /api/payment-invoices/{id}`. Проверки: `PaymentInvoiceServiceTest`, `frontend/src/invoices.test.ts`; `node scripts/payment-invoice-smoke-test.mjs` с обязательным `BASE_URL` отдельного тестового стека с начислениями. Smoke-тест создаёт и удаляет только собственные черновики.

Таблица оказанных услуг показывает дату оказания без времени. В общем разделе «Оказанные услуги» клиент, договор и ссылка на заявку на услугу представлены отдельными столбцами. В карточке заявки на услугу эти три столбца скрыты. Столбец «Поставка / вывоз» не показывается в обоих представлениях; суммы и пагинация сохранены.

В создании и просмотре поставки на вкладке «Основное» доступны «Дата и время поступления» (`arrivalAt`) и «Грузоотправитель» (`consignor`); для вывоза — «Дата и время вывоза» (`departureAt`) и «Грузополучатель» (`consignee`). Поля необязательны, имена вводятся текстом до 255 символов. POST-запросы и GET карточки поддерживают эти поля. Дата передаётся локальным ISO datetime без часового пояса (например, `2026-10-29T14:30`), без преобразования в UTC. Миграция V37 добавляет nullable-колонки без изменения существующих данных; у прежних и автоматически создаваемых заявок поля остаются пустыми. Дата вывоза относится к заявке и не подменяет дату отправления рейса. Автоматического копирования этих полей между разными заявками нет.

Проверка новых полей: `node scripts/order-metadata-smoke-test.mjs` с обязательным `BASE_URL` отдельного dev-стека после применения V37. Тест создаёт заявки, проверяет сохранение и чтение полей, совместимость прежних payload и отклонение неверных значений. Backend unit-тесты: `OrderMetadataStoreTest`.

Карточка заявки на услугу разделена на четыре вкладки: «Основное» (клиент, договор, статус), «Заявки на поставку», «Заявки на вывоз», «Возвратные заявки». При открытии выбрано «Основное». Выбор КТК и вывозов сохраняется при переключении вкладок; создание рейсов и возвратов доступно в соответствующих таблицах. Начисления остаются общим блоком под вкладками. Вкладки поддерживают клавиши ←/→, Home и End. API и схема БД не изменены.

Локальный MVP для заявок на поставку и вывоз КТК. Проект объединяет React + TypeScript, Spring Boot JDBC/Flyway и PostgreSQL.

Документ актуализирован 26 октября 2026 года: договоры и новый процесс заявки на услугу КП-ЖД → КП-Авто.

## Контекст для нового чата

Перед изменениями необходимо:

1. Прочитать этот README полностью.
2. Проверить `git status --short` и не удалять чужие или несвязанные изменения.
3. Изучить последние миграции, соответствующие изменяемой области.
4. Не редактировать уже применённые миграции. Следующая миграция должна иметь номер `V29` или выше.
5. Сохранять контракты и сценарии поставки, вывоза и накладных.
6. После изменений выполнить backend-тесты, frontend lint/test/build и подходящие smoke-тесты.

Критические инварианты:

- поддерживается только площадка `CONTAINER`;
- транспорт: `VEHICLE` или `RAILWAY`;
- единственный статус заявки в MVP — `DRAFT`;
- автомобильный вывоз продолжает работать без `fillingType`;
- старый номерной ЖД-вывоз без `fillingType` трактуется как `ALL`;
- ЖД-поставка создаётся по существующим свободным накладным;
- безномерные данные допустимы для ЖД-вывоза и для порожних КТК в автозаявке на вывоз (`VEHICLE_UNNUMBERED`);
- номерные и количественные данные нельзя смешивать вопреки матрице `fillingType`;
- frontend последовательно разделяет уровни `Вагоны`, `КТК` и `Груз`, но хранит их в прежнем состоянии формы и отправляет прежний payload;
- заявка и весь её состав создаются одной транзакцией;
- справочные записи автоматически из запроса не создаются;
- TOS, Datareon, 1С, ЭТРАН и интеграционные события не реализованы и не должны добавляться без отдельного ТЗ;
- smoke-тесты записывают тестовые заявки и накладные в локальную dev-БД.

## Стек и структура

| Слой | Технологии | Расположение |
|---|---|---|
| Frontend | React, TypeScript, Vite, React Router | `frontend/` |
| Backend | Java 21, Spring Boot 4, Spring JDBC, Bean Validation | `backend/` |
| База данных | PostgreSQL 16, Flyway | `backend/src/main/resources/db/` |
| Оркестрация | Docker Compose, Nginx | `compose.yaml`, `frontend/nginx.conf` |
| Сквозные тесты | PowerShell | `scripts/` |

Основные файлы backend:

- API заявок: `backend/src/main/java/ru/billing/app/order/*Controller.java`;
- бизнес-валидация: `OrderRequestValidator.java`, `OrderScenarioPolicy.java`;
- транзакционные сервисы: `ReceivingOrderService.java`, `ShippingOrderService.java`;
- JDBC-хранилища: `ReceivingOrderStore.java`, `ShippingOrderStore.java`;
- накладные: `backend/src/main/java/ru/billing/app/waybill/`;
- справочники: `backend/src/main/java/ru/billing/app/reference/`;
- формат ошибок: `backend/src/main/java/ru/billing/app/error/`.

Основные файлы frontend:

- маршруты: `frontend/src/App.tsx`;
- API-клиент: `frontend/src/api.ts`;
- типы: `frontend/src/domain.ts`;
- состояние и payload заявки: `frontend/src/orderForm.ts`;
- создание заявки: `frontend/src/pages/CreateOrderPage.tsx`;
- реестр и карточка: `OrderListPage.tsx`, `OrderViewPage.tsx`;
- накладные: `WaybillCreatePage.tsx`, `WaybillRegistryPage.tsx`;
- стили: `frontend/src/styles.css`.

## Быстрый запуск

Docker Desktop должен быть запущен.

```powershell
cd "C:\Users\Пользователь\Documents\Билинг 2.0"
docker compose up -d --build
```

После запуска:

- frontend: http://localhost:3000
- API: http://localhost:8080/api/health
- health backend: http://localhost:8080/actuator/health
- PostgreSQL: `localhost:5432`

Проверка контейнеров и логов:

```powershell
docker compose ps
docker compose logs backend --tail 100
docker compose logs frontend --tail 100
```

Остановка без удаления данных:

```powershell
docker compose down
```

Полное удаление контейнеров и dev-БД:

```powershell
docker compose down -v
```

`down -v` удаляет Docker volume PostgreSQL без возможности восстановления средствами проекта.

## Переменные окружения и доступ к БД

Значения по умолчанию находятся в `.env.example`:

| Переменная | По умолчанию |
|---|---|
| `POSTGRES_DB` | `billing` |
| `POSTGRES_USER` | `billing` |
| `POSTGRES_PASSWORD` | `billing` |
| `DB_PORT` | `5432` |
| `BACKEND_PORT` | `8080` |
| `FRONTEND_PORT` | `3000` |

Подключение с хоста:

```text
Host: localhost
Port: 5432
Database: billing
User: billing
Password: billing
```

Вход через контейнер:

```powershell
docker exec -it billing-db-1 psql -U billing -d billing
```

## Разработка без полной пересборки Docker

Запустить только PostgreSQL:

```powershell
docker compose up -d db
```

Backend — нужны Java 21+ и Maven:

```powershell
cd backend
mvn spring-boot:run
```

Frontend — нужен Node.js 22+:

```powershell
cd frontend
npm install
npm run dev
```

Vite перенаправляет `/api` и `/actuator` на локальный backend. Docker запускает backend с профилем `dev`, который подключает повторяемый seed `db/dev/R__development_seed.sql`.

## Маршруты frontend

| URL | Назначение |
|---|---|
| `/receiving-orders` | реестр заявок на поставку |
| `/receiving-orders/new` | создание заявки на поставку |
| `/receiving-orders/:orderId` | карточка заявки на поставку |
| `/shipping-orders` | реестр заявок на вывоз |
| `/shipping-orders/new` | создание заявки на вывоз |
| `/shipping-orders/:orderId` | карточка заявки на вывоз |
| `/waybills` | агрегированный реестр накладных |
| `/waybills/create` | создание накладной |

Авторизация в текущем MVP отсутствует.

### Последовательные этапы форм

После ТЗ-8 состав заявки и накладной разделён по сущностям. На вкладке вагонов нет редактирования КТК и груза, на вкладке КТК нет полей ЕТСНГ и массы.

| Сценарий | Этапы создания и вкладки просмотра |
|---|---|
| Авто-поставка | `Основное → КТК → Груз` |
| Авто-вывоз | `Основное → КТК → Груз` |
| ЖД-поставка | `Основное → Накладные → Вагоны → КТК → Груз` |
| ЖД-вывоз всех `fillingType` | `Основное → Вагоны → КТК → Груз` |
| Создание накладной | `Основное → Вагоны → КТК → Груз` |

В формах создания будущая вкладка недоступна до прохождения текущей; по пройденным этапам можно перемещаться назад без потери введённых значений. В карточке готовой заявки все вкладки доступны свободно. Этапы ЖД-поставки после выбора накладных read-only и используют только данные существующего `SelectedWaybill`; дополнительных API-запросов нет. `buildPayload` и `buildWaybillPayload` после UI-разделения не изменены.

## Реализованные бизнес-сценарии

### Поставка, `VEHICLE`

Пользователь выбирает клиента, контейнерную площадку, номерные КТК и груз для каждого гружёного КТК.

Хранение:

```text
receiving_order
└── receiving_order_container
    └── receiving_order_container_item
```

### Поставка, `RAILWAY`

ЖД-заявка на поставку создаётся по одной или нескольким свободным накладным одной группы. Группа определяется станцией отправления, станцией назначения и плательщиком.

После привязки накладная больше не показывается в режиме выбора свободных накладных. Обычный реестр продолжает её отображать.

### Вывоз, `VEHICLE`

Существующий контракт `containers[]`. Поле `fillingType` можно не передавать; backend использует `ALL`.

### Вывоз, `RAILWAY`

Поддерживаются четыре типа заполнения:

| `fillingType` | Интерфейс | Вагоны | КТК |
|---|---|---|---|
| `ALL` | Заданы номера вагонов и КТК | номерные | номерные внутри вагонов |
| `RAILWAY_CARRIAGE` | Заданы только номера вагонов | номерные | количественные группы |
| `CONTAINER` | Заданы только номера КТК | количественные группы | номерные без привязки к вагону |
| `NONE` | Не заданы номера вагонов и КТК | количественные группы | количественные группы |

Для количественной группы гружёных КТК можно указать несколько кодов ЕТСНГ. Масса задаётся на один КТК. Порожняя группа не содержит груз.

## Модель данных

### Справочники

| Таблица | Назначение |
|---|---|
| `client` | клиенты |
| `container` | номерные КТК |
| `railway_carriage` | номерные вагоны |
| `railway_carriage_type` | типы вагонов для количественных строк |
| `etsng_code` | грузы ЕТСНГ |
| `terminal_area_catalog` | площадки; в MVP используется `CONTAINER` |

Допустимые типы количественных КТК:

```text
STANDARD_20
STANDARD_40
```

### Заявки на поставку

```text
receiving_order
├── receiving_order_container
│   └── receiving_order_container_item
└── waybill через waybill.receiving_order_id
    ├── waybill_railway_carriage
    │   └── waybill_container
    └── waybill_product
```

### Заявки на вывоз

```text
shipping_order
├── shipping_order_railway_carriage
├── shipping_order_container
│   └── shipping_order_container_item
├── shipping_order_railway_carriage_qty
└── shipping_order_container_qty
    └── shipping_order_etsng_code
```

Важные связи:

- одна строка `shipping_order_railway_carriage` представляет один конкретный вагон заявки;
- `shipping_order_container.shipping_order_railway_carriage_id` опционален;
- составной FK гарантирует, что КТК и вагон принадлежат одной заявке;
- один номерной вагон нельзя повторить в одной заявке;
- один номерной КТК нельзя повторить в одной заявке;
- количество и масса защищены DB CHECK `> 0`;
- тип вагона, включая `NULL`, уникален внутри количественного состава заявки;
- дочерние данные заявки удаляются каскадно;
- используемые справочники удаляются с `RESTRICT`.

### Миграции

| Миграция | Назначение |
|---|---|
| `V1` | базовая точка Flyway |
| `V2` | заявки, КТК, вагоны, клиенты и ЕТСНГ |
| `V3` | нормализация кодов справочников |
| `V4` | площадка и тип транспорта |
| `V5` | накладные, вагоны, КТК и грузы накладной |
| `V6` | номерные вагоны и КТК из исходных данных |
| `V7` | первоначальная связь ЖД-вывоза с КТК |
| `V8` | `filling_type`, каноническая модель вагона и количественный состав |
| `V9` | минимальный тип вагона «Фитинговая платформа» |
| `V10` | актуальные значения родов вагонов |
| `V11` | автоматическая нумерация накладных |
| `V12` | ФИО водителя и государственный номер ТС в автозаявках |
| `V13` | справочник комплексных услуг и их последовательных этапов |
| `V14` | заявки на комплексные услуги и связи поставки/вывоза с этапами |
| `V15` | безномерный автомобильный вывоз порожних КТК |
| `V16` | несколько автозаявок на один этап вывоза комплексной услуги |

Миграции V17–V23 содержат исторические изменения услуг, типоразмеров КТК и площадки. V24 удаляет таблицы услуг и связи с ними, сохраняя заявки на поставку/вывоз, накладные и их состав. V25 добавляет договоры и новый процесс заявки на услугу. Применённые миграции V1–V25 не изменять; следующая — V29.

## API

Все ошибки возвращаются в формате RFC 7807 `ProblemDetail`. Бизнес-код находится в поле `code`.

Пример:

```json
{
  "type": "about:blank",
  "title": "Ошибка выполнения запроса",
  "status": 400,
  "detail": "Добавьте хотя бы один вагон",
  "code": "RAILWAY_CARRIAGES_REQUIRED"
}
```

### Системные endpoint

| Метод | Endpoint | Назначение |
|---|---|---|
| `GET` | `/api/health` | простой статус API |
| `GET` | `/actuator/health` | health Spring Boot |

### Справочники

| Метод | Endpoint |
|---|---|
| `GET` | `/api/references/clients?q=&limit=100` |
| `GET` | `/api/references/containers?q=&limit=100` |
| `GET` | `/api/references/etsng-codes?q=&limit=100` |
| `GET` | `/api/references/railway-carriages?q=&limit=100` |
| `GET` | `/api/references/railway-carriage-types?q=&limit=100` |
| `GET` | `/api/references/terminal-areas` |
| `GET` | `/api/references/transport-types` |

Элементы обычного справочника возвращаются как `{ "id": "uuid", "name": "отображаемое значение" }`.

### Заявки

Для поставки и вывоза доступны одинаковые операции:

| Метод | Endpoint | Назначение |
|---|---|---|
| `GET` | `/api/receiving-orders?page=0&size=20` | реестр поставки |
| `GET` | `/api/receiving-orders/{id}` | карточка поставки |
| `POST` | `/api/receiving-orders` | создание поставки |
| `GET` | `/api/shipping-orders?page=0&size=20` | реестр вывоза |
| `GET` | `/api/shipping-orders/{id}` | карточка вывоза |
| `POST` | `/api/shipping-orders` | создание вывоза |

Успешное создание возвращает:

```json
{
  "id": "uuid",
  "code": 15,
  "status": "DRAFT"
}
```

Карточка заявки содержит прежние и новые коллекции:

```text
id, code, clientId, clientName, terminalArea,
transportType, fillingType, status,
containers, waybills, railwayCarriages,
railwayCarriageQuantities, containerQuantities
```

Неактуальные для сценария коллекции возвращаются пустыми, а не смешиваются с актуальным составом.

### Накладные

| Метод | Endpoint | Назначение |
|---|---|---|
| `POST` | `/api/waybills` | создать накладную |
| `POST` | `/api/waybills/grouped/page` | получить агрегированные группы |

Фильтр групп:

```json
{
  "filter": {
    "departureStation": 11111,
    "destinationStation": 999999,
    "payer": "ФИТ"
  },
  "pageInfo": { "page": 0, "size": 20 },
  "sortingColumn": "departureStation",
  "sortingDirection": "ASC",
  "availableForReceivingOrderOnly": true
}
```

## Контракты создания заявок

Во всех примерах UUID необходимо получать из API справочников.

### Автомобильный вывоз

Во всех запросах создания поставки и вывоза обязательны `clientId` и `contractId`; договор должен принадлежать выбранному клиенту. Примеры ниже показывают состав, `contractId` берите из справочника договоров.


```json
{
  "clientId": "uuid-client",
  "terminalAreaId": "uuid-container-area",
  "transportType": "VEHICLE",
  "containers": [
    {
      "containerId": "uuid-container",
      "empty": false,
      "cargo": {
        "etsngCodeId": "uuid-etsng",
        "weight": 24500.125
      }
    }
  ]
}
```

Для порожнего КТК: `"empty": true`, `"cargo": null`.

### ЖД-поставка по накладным

```json
{
  "clientId": "uuid-client",
  "terminalAreaId": "uuid-container-area",
  "transportType": "RAILWAY",
  "containers": [],
  "waybillIds": ["uuid-waybill-1", "uuid-waybill-2"]
}
```

### ЖД-вывоз `ALL`

`fillingType` можно не передавать для совместимости со старым контрактом.

```json
{
  "clientId": "uuid-client",
  "terminalAreaId": "uuid-container-area",
  "transportType": "RAILWAY",
  "fillingType": "ALL",
  "railwayCarriages": [
    {
      "railwayCarriageId": "uuid-carriage",
      "containers": [
        {
          "containerId": "uuid-container",
          "empty": false,
          "cargo": {
            "etsngCodeId": "uuid-etsng",
            "weight": 24500.000
          }
        }
      ]
    }
  ]
}
```

### ЖД-вывоз `RAILWAY_CARRIAGE`

Известны номера вагонов, КТК задаются количественными группами.

```json
{
  "clientId": "uuid-client",
  "terminalAreaId": "uuid-container-area",
  "transportType": "RAILWAY",
  "fillingType": "RAILWAY_CARRIAGE",
  "railwayCarriages": [
    { "railwayCarriageId": "uuid-carriage-1", "containers": [] },
    { "railwayCarriageId": "uuid-carriage-2", "containers": [] }
  ],
  "containerQuantities": [
    {
      "quantity": 3,
      "type": "STANDARD_20",
      "empty": true,
      "items": []
    },
    {
      "quantity": 2,
      "type": "STANDARD_40",
      "empty": false,
      "items": [
        { "etsngCodeId": "uuid-etsng", "weight": 30000.000 }
      ]
    }
  ]
}
```

### ЖД-вывоз `CONTAINER`

Известны номера КТК, вагоны задаются количеством и необязательным типом.

```json
{
  "clientId": "uuid-client",
  "terminalAreaId": "uuid-container-area",
  "transportType": "RAILWAY",
  "fillingType": "CONTAINER",
  "railwayCarriageQuantities": [
    { "quantity": 4, "typeId": "uuid-carriage-type-or-null" }
  ],
  "containers": [
    {
      "containerId": "uuid-container",
      "empty": true,
      "cargo": null
    }
  ]
}
```

### ЖД-вывоз `NONE`

Номера вагонов и КТК неизвестны.

```json
{
  "clientId": "uuid-client",
  "terminalAreaId": "uuid-container-area",
  "transportType": "RAILWAY",
  "fillingType": "NONE",
  "railwayCarriageQuantities": [
    { "quantity": 4, "typeId": null }
  ],
  "containerQuantities": [
    {
      "quantity": 1,
      "type": "STANDARD_20",
      "empty": false,
      "items": [
        { "etsngCodeId": "uuid-etsng", "weight": 28000.000 }
      ]
    }
  ]
}
```

Неиспользуемые коллекции могут отсутствовать либо быть пустыми.

### Создание накладной

```json
{
  "receivingOrderId": null,
  "departureStation": 11111,
  "destinationStation": 999999,
  "payer": "ФИТ",
  "railwayCarriages": [
    {
      "railwayCarriageId": "uuid-carriage",
      "containerIds": ["uuid-container"]
    }
  ],
  "products": [
    { "etsngCodeId": "uuid-etsng", "weight": 12500.000 }
  ]
}
```

Номер накладной назначается автоматически при создании. Последовательность начинается с `1743125934`.

## Основные правила валидации

- клиент, площадка и транспорт обязательны;
- все UUID должны существовать в справочниках;
- КТК и вагоны не повторяются внутри заявки;
- для гружёного КТК груз и положительная масса обязательны;
- для порожнего КТК груз запрещён;
- количество вагонов и КТК — целое число больше нуля;
- масса содержит не более трёх знаков после запятой;
- один тип количественного вагона не повторяется, включая неизвестный тип `null`;
- полностью одинаковые количественные группы КТК запрещены;
- `RAILWAY_CARRIAGE`: нужны номерные вагоны и количественные КТК;
- `CONTAINER`: нужны количественные вагоны и номерные КТК;
- `NONE`: нужны количественные вагоны и количественные КТК;
- `VEHICLE_UNNUMBERED`: только для автовывоза, ровно одна количественная строка с положительным количеством КТК, типоразмером, порожним состоянием и без груза.;
- при несовместимом составе запрос отклоняется целиком;
- неизвестный `fillingType` возвращает `INVALID_FILLING_TYPE`.

Часто используемые бизнес-коды ошибок:

```text
CLIENT_NOT_FOUND
TERMINAL_AREA_NOT_FOUND
CONTAINER_NOT_FOUND
RAILWAY_CARRIAGE_NOT_FOUND
ETSNG_CODE_NOT_FOUND
INVALID_FILLING_TYPE
UNNUMBERED_ONLY_FOR_CONTAINER_RAILWAY
RAILWAY_CARRIAGES_REQUIRED
RAILWAY_CARRIAGE_QUANTITIES_REQUIRED
CONTAINERS_REQUIRED
CONTAINER_QUANTITIES_REQUIRED
NUMBERED_RAILWAY_CARRIAGES_NOT_ALLOWED
RAILWAY_CARRIAGE_QUANTITIES_NOT_ALLOWED
NUMBERED_CONTAINERS_NOT_ALLOWED
CONTAINER_QUANTITIES_NOT_ALLOWED
DUPLICATE_RAILWAY_CARRIAGE
DUPLICATE_CONTAINER
DUPLICATE_RAILWAY_CARRIAGE_TYPE
DUPLICATE_CONTAINER_QUANTITY_ROW
INVALID_QUANTITY
CARGO_REQUIRED
CARGO_FOR_EMPTY_CONTAINER
INVALID_WEIGHT
WAYBILL_NOT_FOUND
WAYBILL_ALREADY_LINKED
WAYBILLS_FROM_DIFFERENT_GROUPS
```

## Тесты и проверка

Полная сборка запускает Maven-тесты, frontend lint, Vitest и production build:

```powershell
docker compose build
```

Отдельно:

```powershell
cd backend
mvn test

cd ..\frontend
npm run lint
npm run test
npm run build
```

Smoke-тесты выполняются только на запущенном стеке и изменяют dev-БД:

```powershell
cd "C:\Users\Пользователь\Documents\Билинг 2.0"

# Для отдельного тестового стека можно задать $env:BASE_URL = 'http://localhost:3100'
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\waybill-smoke-test.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\tz4-railway-order-smoke-test.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\tz5-railway-shipping-smoke-test.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\tz6-unnumbered-shipping-smoke-test.ps1
```

Назначение:

| Скрипт | Проверяет |
|---|---|
| `smoke-test.ps1` | базовые авто-заявки, ссылки, валидацию и маршруты |
| `waybill-smoke-test.ps1` | создание, агрегацию и откат накладных |
| `tz4-railway-order-smoke-test.ps1` | ЖД-поставку по накладным и конкурентную привязку |
| `tz5-railway-shipping-smoke-test.ps1` | номерной ЖД-вывоз `ALL` |
| `tz6-unnumbered-shipping-smoke-test.ps1` | `RAILWAY_CARRIAGE`, `CONTAINER`, `NONE` и регрессии |

## Договоры и заявка на услугу (V25)

В «Основное» поставки и вывоза добавлен обязательный договор. Выпадающий список фильтруется по клиенту; смена клиента сбрасывает договор. Тестовый договор № 1 создаётся для каждого существующего клиента; отдельный dev seed обеспечивает договоры и на чистой базе. Управления справочником договоров пока нет.

Новый раздел `/service-orders` содержит реестр, создание и карточку заявки на услугу. Создание: «Основное» (клиент, договор) → накладные → вагоны → КТК → груз. Площадка фиксирована как CONTAINER, транспорт поставки — RAILWAY. После сохранения создаются родительская заявка, одна поставка КП-ЖД по выбранным свободным накладным и по одной заявке на вывоз КП-Авто на каждый уникальный КТК. Все КТК автовывоза — порожние, без груза. Повторяющийся в нескольких накладных КТК порождает только один вывоз. Накладные без КТК не принимаются. Весь процесс транзакционный, конкурентное использование одной накладной даёт один успех и один конфликт.

API:
- GET /api/references/contracts?clientId=UUID — договоры (без clientId — все).
- GET /api/service-orders?page=0&size=20 — реестр.
- POST /api/service-orders — {clientId, contractId, waybillIds}; возвращает order, receivingOrder, shippingOrders.
- GET /api/service-orders/{id} — карточка с поставкой и автовывозами.

В receiving_order и shipping_order добавлены contract_id и service_order_id. Автовывоз содержит source_receiving_order_id и source_container_id. FK проверяют принадлежность договора клиенту и согласованность родителя; уникальность по родителю и КТК исключает повторный автовывоз. Старые заявки сохраняются без договора и без новой родительской связи. В карточках и реестрах видны договор и ссылка на родителя.

ФИО водителя и госномер удалены из DTO, FE, валидации и обеих таблиц. Выбор наличия данных для авто удалён из формы; внутренний filling_type сохранён для ЖД и чтения ранее созданного безномерного автовывоза. Самостоятельные поставки и вывозы доступны. Старые каталоги услуг и комплексных услуг не возвращались.

Миграции V1–V24 не изменяются. Следующая миграция — V29. Резервная копия до V25: ChatGPT/Билинг/backups/before-contract-service-flow-2026-10-26 (исходники и database.dump).

Проверка процесса: `node scripts/service-order-flow-smoke-test.mjs`. Все smoke-тесты поддерживают BASE_URL. Запускайте их в отдельном стеке с dev seed: они создают тестовые данные.

## Работа с данными

Очистка бизнес-данных с сохранением справочников:

```sql
TRUNCATE TABLE
    receiving_order,
    shipping_order,
    waybill
RESTART IDENTITY CASCADE;
```

Команда удаляет заявки, накладные и весь зависимый состав. Выполнять её только в локальной dev-БД.

Проверка версии миграций:

```sql
SELECT installed_rank, version, description, success
FROM flyway_schema_history
ORDER BY installed_rank;
```

## Текущие ограничения MVP

- нет авторизации и ролей;
- нет редактирования и удаления заявок через API;
- нет статусов после `DRAFT`;
- нет интеграций TOS, Datareon, 1С и ЭТРАН;
- нет услуг, тарифов, начислений и счетов;
- нет контроля остатков КТК и владельцев;
- количественные КТК не распределяются по конкретным вагонам после создания;
- фактические номера для безномерного состава автоматически не подставляются;
- справочник типов вагонов содержит только минимальный seed «Фитинговая платформа».

## Правила дальнейшей разработки

- изменения схемы делать только новой Flyway-миграцией;
- новые сценарии добавлять в существующие сущности и endpoint, если отдельный ресурс не обоснован;
- не дублировать таблицы номерных КТК, вагонов или груза;
- сохранять условную обязательность коллекций в доменном валидаторе, а не через безусловный `@NotEmpty`;
- справочники валидировать до вставки состава либо внутри общей транзакции;
- не выполнять внешние интеграционные действия без явного требования;
- не удалять пользовательские изменения и не использовать `git reset --hard`;
- при изменении API обновлять одновременно Java DTO, TypeScript-типы, форму, карточку, тесты и этот README;
- при добавлении нового сценария создавать отдельный smoke-тест либо расширять ближайший существующий;
- в итоговом отчёте указывать миграции, изменённые контракты и фактически выполненные проверки.



27 октября 2026: V26 добавляет клиентов ООО «Хаир», ООО «Опт-Логистика», ООО «Мангуст» и связанные договоры ОП-160/25, ОП-330/25, ОП-220/25. Повторный запуск вставок не создаёт дубликатов.


V27 добавляет к тем же клиентам договоры ОП-160/26, ОП-330/26 и ОП-220/26, сохраняя договоры за 2025 год.


V28 удаляет клиента «Самара», его договоры и заявки на услугу, поставку и вывоз. Связанные накладные сохраняются без привязки к удалённым поставкам. Копия БД до удаления: ChatGPT/Билинг/backups/before-samara-removal-2026-10-27/database.dump.


### Показатели услуг в карточке заявки

На вкладке «Основное» отображаются карточки «Приём КТК» и «Вывоз КТК» в формате «Всего КТК / Выполнено». Состав поставки виден уже в черновике; для вывоза общее количество берётся из созданных заявок, включая черновики и подтверждённые. КТК без заявки на вывоз показываются отдельно. Приёмка учитывается только после выполнения первоначальной поставки. Название услуги берётся из справочника с учётом зафиксированной при приёмке разновидности. До приёмки разновидность определяется по текущему составу поставки.

Блок возвратной услуги отображается только при наличии КТК в возвратных поставках, связанных с вывозами этой заявки на услугу. Он показывает карточку «Поставка КТК» в формате «Всего КТК / Выполнено», где общее количество взято из созданных возвратных заявок. Черновики и подтверждённые заявки входят в количество созданных. Все показатели рассчитываются сервером без изменения данных и без зависимости от пагинации списка оказанных услуг.
