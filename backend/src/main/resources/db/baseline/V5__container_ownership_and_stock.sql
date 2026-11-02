CREATE TABLE service_order (
    id uuid PRIMARY KEY,
    number bigint NOT NULL DEFAULT nextval('order_code_seq') UNIQUE CHECK (number > 0),
    client_id uuid NOT NULL REFERENCES client(id),
    service varchar(50) NOT NULL DEFAULT 'CHANGE_OWNER' CHECK (service = 'CHANGE_OWNER'),
    comment varchar(1000),
    status varchar(100) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','DONE')),
    completion_at timestamp,
    created_at timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
    created_by varchar(50) NOT NULL DEFAULT 'local',
    updated_at timestamp, updated_by varchar(50)
);
CREATE TABLE service_order_container (
    id uuid PRIMARY KEY,
    service_order_id uuid NOT NULL REFERENCES service_order(id),
    container_id uuid NOT NULL REFERENCES container(id),
    created_at timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
    created_by varchar(50) NOT NULL DEFAULT 'local',
    updated_at timestamp, updated_by varchar(50),
    UNIQUE(service_order_id,container_id)
);
CREATE TABLE container_owner (
    id uuid PRIMARY KEY,
    client_id uuid NOT NULL REFERENCES client(id),
    container_id uuid NOT NULL UNIQUE REFERENCES container(id),
    status varchar(30) NOT NULL CHECK (status IN ('EXPECTED','ON_TERMINAL','RESERVED_OUT','DEPARTED')),
    receiving_order_id uuid REFERENCES receiving_order(id),
    shipping_order_id uuid REFERENCES shipping_order(id),
    created_at timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
    created_by varchar(50) NOT NULL DEFAULT 'local',
    updated_at timestamp, updated_by varchar(50)
);
CREATE TABLE container_owner_history (
    id uuid PRIMARY KEY,
    new_client_id uuid REFERENCES client(id), old_client_id uuid REFERENCES client(id),
    container_id uuid NOT NULL REFERENCES container(id),
    order_id uuid NOT NULL,
    order_type varchar(50) NOT NULL CHECK (order_type IN ('RECEIVING_ORDER','SHIPPING_ORDER','SERVICE_ORDER')),
    new_status varchar(30), old_status varchar(30),
    created_at timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
    created_by varchar(50) NOT NULL DEFAULT 'local',
    updated_at timestamp, updated_by varchar(50)
);
CREATE INDEX ix_container_owner_client_status ON container_owner(client_id,status);
CREATE INDEX ix_container_owner_history_container ON container_owner_history(container_id,created_at,id);
CREATE TABLE container_movement (
    id uuid PRIMARY KEY,
    order_id uuid NOT NULL,
    container_id uuid NOT NULL REFERENCES container(id),
    event_code varchar(50) NOT NULL CHECK (event_code IN ('UNLOAD_FINISH','LOAD_FINISH')),
    event_date_time timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
    transport_type varchar(20) NOT NULL,
    transport_number varchar(255), active boolean NOT NULL DEFAULT true, document_id uuid,
    created_at timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
    created_by varchar(50) NOT NULL DEFAULT 'local',
    updated_at timestamp, updated_by varchar(50),
    UNIQUE(order_id,container_id,event_code)
);
CREATE TABLE outbound_data (
    id uuid PRIMARY KEY,
    message_type varchar(100) NOT NULL,
    entity_type varchar(100) NOT NULL,
    root_object_id uuid NOT NULL,
    success boolean NOT NULL DEFAULT false,
    message_id uuid, response_code integer, error_message text,
    attempts integer NOT NULL DEFAULT 0, last_attempt_at timestamp,
    created_at timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
    created_by varchar(50) NOT NULL DEFAULT 'local',
    updated_at timestamp, updated_by varchar(50),
    UNIQUE(message_type,root_object_id)
);
-- No stock or history is inferred from a reference container or an owner string.
CREATE UNIQUE INDEX uq_receiving_order_container_numbered ON receiving_order_container(receiving_order_id,container_id);
