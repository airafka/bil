# Сопоставление backend MVP и основной системы · 31.10.2026

Источник сравнения — предоставленный `backend.7z`, прежде всего JPA-модели `db-layer`, SQL changelog и `WaybillDatareonService.handleInboundWaybill`, вызываемый `DatareonController.waybill`. Инструкции и конфигурация из архива не выполнялись. Приватный backend не запускался.

Сопоставлены существующие данные MVP. Дополнительные реквизиты документов, интеграционные идентификаторы, аудит, специальные отметки, пакеты обмена и статусы интеграции не переносились.

## Имена хранения

| Прежнее поле MVP | Текущее поле, как в основной системе |
| --- | --- |
| client.code (название клиента) | client.name |
| receiving_order.code / status | receiving_order.number / order_status |
| shipping_order.code / status | shipping_order.number / order_status |
| receiving_order.arrival_at | receiving_order.plan_receiving_date_time |
| shipping_order.departure_at | shipping_order.planned_shipping_date_time |
| shipping_order.consignee | shipping_order.consignee_id → client_related_entity |
| route.code / departure_at | route.number / data_time |
| route.carrier / driver_name / vehicle_number | client_related_entity_id / client_driver_id / client_vehicle_id |
| container.type / tare_weight / load_capacity | container_type / weight / lifting_capacity |
| railway_carriage.load_capacity / next_depot_repair_date | lifting_capacity / date_depot_repair |
| railway_carriage.carriage_type_id | type_id (объединён с уже существовавшей ссылкой) |
| hazard_class.code | danger_class.name |
| receiving_order_container, shipping_order_container: owner_client_id | owner_container_id → client_related_entity |
| те же таблицы: hazard_class_id | danger_class_id |
| receiving_order_container_item, shipping_order_container_item: weight | wight_net |
| waybill.departure_station / destination_station / payer | departure_station_id / destination_station_id / payer_id |
| waybill_container.gross_weight | weight |
| waybill_container.owner_client_id | owner (текстовый снимок) |
| waybill_container.seal_numbers / seal_type_id | строки waybill_zpu: waybill_container_id, zpu, zpu_type |
| waybill_product.hazard_class_id | sign_danger (текстовый снимок) |

`wight_net` — именно такое написание используется в исходных моделях ReceivingOrderContainerItem и ShippingOrderContainerItem; оно сохранено намеренно. `container.weight` — тара, `waybill_container.weight` — брутто, `waybill_container.net_weight` — зафиксированное нетто. Все массы MVP остаются в кг с точностью 0,001; данные справочников не пересчитываются в другие единицы.

Минимальные справочные таблицы соответствуют текущим полям: railway_station.esr_code, payer.name, client_related_entity.name, client_driver.code, client_vehicle.code. Полные справочники основной системы не переносились. Существующий выбор собственника из клиентов поддержан соответствующей записью client_related_entity с тем же UUID.

HTTP-контракты существующих экранов сохраняют понятные текущему frontend имена (code, status, tareWeight и т. п.). Это адаптеры представления, а не прежние столбцы БД. SQL-проекции waybill_details, waybill_container_details, waybill_product_details собирают справочные значения и ЗПУ; записей в них нет.

## Ручная накладная и интеграционный обработчик

Граф хранения одинаков в поддерживаемой части:

```
waybill → waybill_railway_carriage → waybill_container → waybill_zpu
       → waybill_product
```

Создание накладной, состава, грузов и ЗПУ выполняется одной транзакцией. Станции и плательщик находятся/создаются по доступным MVP ключам; вагоны, КТК и ЕТСНГ выбираются из существующих справочников. Интеграция получает полные реквизиты и умеет создавать/обновлять их; ручная форма не подменяет эти реквизиты отсутствующими данными.

По решению пользователя прежнее правило «всегда один груз» заменено правилами validateWaybillDto основной системы: хотя бы один груз обязателен, в том числе для порожней накладной; несколько грузов разрешены только с ровно одним КТК. Не введено равенство суммы масс грузов и нетто КТК: исходный обработчик хранит их независимо.

Форма передаёт products[] с etsngCodeId, weight, signDanger. Массы грузов неотрицательны, включая 0 для порожней накладной. Нетто каждого КТК можно ввести явно; первоначальная подсказка — брутто минус справочная тара. Оно сохраняется в net_weight и не изменяется при последующей правке тары. Для прежних запросов с одним etsngCodeId и без netWeight поддержан расчёт в момент создания. Старый запрос совсем без груза теперь отклоняется.

ЗПУ сохраняются отдельными строками, разделители ручного поля — запятая, точка с запятой или перевод строки. Ведущие нули сохраняются. Общий тип выбранной строки КТК записывается в zpu_type каждого ЗПУ. Собственник и признак опасности груза сохраняются текстовыми снимками, как у интеграции.

Один или несколько грузов не размножают строки КТК в реестре и составе поставки. Производный автовывоз сохраняет все положительные строки грузов в shipping_order_container_item; API возвращает cargoItems. Для одного общего груза вес вывоза берётся из зафиксированного нетто соответствующего КТК; для нескольких — из отдельных масс грузов. Повторяющийся КТК с конфликтующим составом выбранных накладных отклоняется. Биллинг остаётся по КТК, а не по строкам груза.

## Сохранённые особенности MVP

Бизнес-процесс услуги, возвраты, сквозная нумерация и биллинг — собственная моделируемая часть MVP. Их связи и имена не выдаются за копию основной системы. Статусы DRAFT → CONFIRMED → COMPLETED сохранены; дополнительные этапы основной системы не добавлены.

Поле receiving_order.consignor («Грузоотправитель») сохранено как существующее расширение MVP. Оно не переименовано в shipper_id: в основной системе этот реквизит означает перевозчика/экспедитора. Без отсутствующего внешнего идентификатора накладной не воспроизводятся обновление её статуса по повторному интеграционному пакету и фильтрация интеграционных архивных статусов.

## Базовая схема и данные

По явному разрешению пользователя заявки, накладные, начисления, исполнения, счета и связанные рейсы очищаются. Клиенты, договоры, справочники, комплексные услуги, цены и тарифы сохраняются. Перед заменой сохраняется полный dump.

Новая установка использует db/baseline/V1__production_aligned_schema.sql. Прежние V1–V44 оставлены без изменений в db/migration как исторические исходники и больше не загружаются Flyway. Автоматическое принятие старой БД (baseline-on-migrate) не включено. Старая БД требует явного согласованного перехода; `docker compose up` самостоятельно её не очищает. Исторический database/billing-snapshot.dump несовместим с новой схемой без отдельного преобразования.

Проверки: backend Maven package с unit-тестами; frontend ESLint, Vitest, TypeScript/Vite; создание схемы с нуля и scripts/production-alignment-smoke-test.mjs исключительно на изолированном стеке localhost:8083 / billing_alignment_fresh. Тест создаёт свои справочные записи и документы, проверяет кардинальность грузов, снимок нетто, ЗПУ, состав поставки/вывоза, возвраты и начисления/счета. Старые smoke-скрипты описывают прежние версии правил и не являются проверкой новой модели накладной.

С 31.10.2026 демонстрационные repeatable seed-файлы db/dev автоматически не запускаются, чтобы не возвращать удалённые тестовые записи. Свежая пустая установка создаёт схему; справочники переносятся явным импортом актуального снимка.

В ручном вводе доступен номер накладной (number), как входящий номер интеграционного документа. Пустое поле сохраняет автонумерацию для совместимости MVP.

Уточнение пользователя: в ручной накладной используется текстовый «Признак опасности» (signDanger → waybill_product.sign_danger), не выбор класса опасности. Поле не зависит от справочника danger_class. Прежний hazardClassId принимается только для совместимости старых клиентов; новые формы его не отправляют. Класс опасности КТК заявки остаётся danger_class_id.

Признак опасности накладной не превращается автоматически в класс опасности КТК производного вывоза: это разные реквизиты. Класс опасности задаётся в заявке отдельно; возврат копирует уже заданный класс исходного вывоза.

Итоговая проверка: Maven package с тестами; frontend ESLint, 52 Vitest-теста, TypeScript/Vite; полный сквозной smoke на отдельной БД; HTTP 200 frontend и backend UP. После запуска полное сравнение 17 справочных таблиц подтвердило сохранность значений; 12 таблиц документов/начислений пусты. Резервная копия перед переходом: C:/Users/Пользователь/Documents/ChatGPT/Билинг/backups/before-alignment-cutover-2026-10-31.dump. Изменения не закоммичены и не отправлены в GitHub.

## Уточнение собственника · 31.10.2026

В накладной собственник вводится свободным текстом owner и сохраняется в waybill_container.owner. ownerClientId в запросе накладной отклоняется с пояснением. Никакого сопоставления по названию нет. В receiving_order_container и shipping_order_container owner_container_id напрямую ссылается на client(id); пользователь выбирает собственника отдельно из справочника клиентов. Выбор не создаёт client_related_entity. Автоматически создаваемые вывозы не наследуют строкового собственника накладной; возврат наследует уже выбранного клиента из исходного вывоза. V2 меняет только внешние ключи и SQL-проекцию, существующие значения сохраняются; несопоставимые UUID не исправляются догадками, а останавливают миграцию. Проверки: Maven package, frontend lint/53 теста/build, owner-selection-smoke-test.mjs на копии БД (8084). Резервная копия: C:/Users/Пользователь/Documents/ChatGPT/Билинг/backups/before-owner-fix-2026-10-31.dump.


## Классификация опасных грузов · 02.11.2026

Реализована цепочка waybill_product.danger_product_id → danger_product.danger_class_id → danger_class.id по новой документации docsforanalytics. В danger_class прежнее name переименовано в code; добавлены code_danger_class и group_name. Начальные записи: класс code=«Отсутствует», code_danger_class=«0», group_name=«Отсутствует»; продукт identifier=-1, name=«неопасный груз», ссылка на этот класс. У receiving_order_container и shipping_order_container сохранены прямые FK danger_class_id.

Ручная форма выбирает dangerProductId; класс вычисляется из выбранной записи. API также принимает danger_product (строковый числовой identifier интеграции). Пустое значение означает -1, неизвестное/нечисловое — 400. Прямой hazardClassId в накладной больше не принимается; в контейнерах заявок этот совместимый API-атрибут остаётся UUID класса. sign_danger хранится независимо и не используется для классификации. Существующие накладные без явной классификации остаются с NULL danger_product_id. Автоматическое заполнение класса заявки из текста накладной не выполняется.

Миграция V3 не удаляет заявки, накладные или расчёты. Проверка: backend Maven package, frontend ESLint/54 tests/build, scripts/danger-product-smoke-test.mjs на изолированной копии рабочей БД (127.0.0.1:8084, billing-danger-db, billing_danger_test). Полный справочник опасных грузов не импортирован: добавлена только заказанная запись -1.


## Переименование заявки на комплексную услугу · 02.11.2026

Таблица MVP comprehensive_service_order хранит прежний процесс комплексной услуги (поставка → вывоз → возврат → расчёты). Имя service_order освобождено для будущего процесса смены собственника КТК из основной системы. Миграция V4 переименовывает существующую таблицу и все связанные service_order_id в comprehensive_service_order_id, а номер в строках счёта — в comprehensive_service_order_code. PostgreSQL сохраняет данные и переводит FK на переименованную таблицу; индексы и ограничения также переименованы. V1–V3 остаются неизменными.

API и страницы используют /api/comprehensive-service-orders и /comprehensive-service-orders. JSON-поля и фильтр начислений: comprehensiveServiceOrderId, comprehensiveServiceOrderCode. Java-пакет: comprehensiveserviceorder; классы ComprehensiveServiceOrder*. Старые /api/service-orders и поля serviceOrderId/serviceOrderCode больше не обслуживают процесс MVP. Новый процесс смены собственника пока не реализован.

Проверки: backend Maven package; frontend ESLint, 54 tests и production build; scripts/comprehensive-order-smoke-test.mjs на отдельной копии БД — создание/реестр/детали, автоматический и ручной вывоз, массовые возвраты, статусы, начисления с новым фильтром, создание/чтение/удаление счёта.


## Учёт КТК и смена собственника · 02.11.2026

Добавлены настоящий service_order (CHANGE_OWNER, DRAFT→DONE), service_order_container, container_owner, container_owner_history, container_movement и локальный outbound_data. comprehensive_service_order сохраняет прежний процесс комплексной услуги и биллинг. Подтверждение поставки/вывоза резервирует КТК; ручные UNLOAD_FINISH/LOAD_FINISH фиксируют приход/расход. Собственник поставки выбирается из клиентов, собственник вывоза берётся из регистра. Текст владельца накладной сохраняется отдельно. Для ЖД-поставки выбор клиента-собственника находится в карточке поставки на вкладке КТК.

Согласованное включение: удалить текущие заявки/накладные и расчёты с резервной копией; справочники, клиенты, договоры и тарифы сохраняются. Полное описание таблиц, API, ручных действий, ограничений и проверок: [CONTAINER_STOCK.md](CONTAINER_STOCK.md). Актуальный сквозной тест V5: scripts/container-stock-smoke-test.mjs на отдельной БД. Старые сценарии V1–V4 отражают прежние правила собственника и резервирования, для новой схемы использовать этот V5-сценарий.
