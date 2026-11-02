--
-- PostgreSQL database dump
--



-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: billing_charge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_charge (
    id uuid NOT NULL,
    service_execution_id uuid NOT NULL,
    client_id uuid NOT NULL,
    contract_id uuid NOT NULL,
    performed_at timestamp with time zone NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    price_without_vat numeric(14,2) NOT NULL,
    amount_without_vat numeric(14,2) NOT NULL,
    price_with_vat numeric(14,2) NOT NULL,
    amount_with_vat numeric(14,2) NOT NULL,
    currency character varying(3) DEFAULT 'RUB'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT billing_charge_check CHECK ((price_with_vat >= price_without_vat)),
    CONSTRAINT billing_charge_check1 CHECK (((amount_without_vat = price_without_vat) AND (amount_with_vat = price_with_vat))),
    CONSTRAINT billing_charge_currency_check CHECK (((currency)::text = 'RUB'::text)),
    CONSTRAINT billing_charge_price_without_vat_check CHECK ((price_without_vat >= (0)::numeric)),
    CONSTRAINT billing_charge_quantity_check CHECK ((quantity = 1))
);


--
-- Name: client; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    CONSTRAINT ck_client_code_not_blank CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT ck_client_code_trimmed CHECK (((name)::text = btrim((name)::text)))
);


--
-- Name: client_driver; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_driver (
    id uuid NOT NULL,
    code character varying(255) NOT NULL
);


--
-- Name: client_related_entity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_related_entity (
    id uuid NOT NULL,
    name character varying(255) NOT NULL
);


--
-- Name: client_vehicle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_vehicle (
    id uuid NOT NULL,
    code character varying(100) NOT NULL
);


--
-- Name: complex_service_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.complex_service_catalog (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    price_without_vat numeric(14,2) NOT NULL,
    price_with_vat numeric(14,2) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    purpose character varying(30),
    CONSTRAINT complex_service_catalog_check CHECK ((price_with_vat >= price_without_vat)),
    CONSTRAINT complex_service_catalog_name_check CHECK (((btrim((name)::text) <> ''::text) AND ((name)::text = btrim((name)::text)))),
    CONSTRAINT complex_service_catalog_price_without_vat_check CHECK ((price_without_vat >= (0)::numeric)),
    CONSTRAINT complex_service_catalog_purpose_check CHECK (((purpose)::text = ANY (ARRAY[('A_TRAIN'::character varying)::text, ('A_WAGON'::character varying)::text, ('B_AUTO_RETURN'::character varying)::text])))
);


--
-- Name: complex_service_tariff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.complex_service_tariff (
    id uuid NOT NULL,
    complex_service_id uuid NOT NULL,
    client_id uuid NOT NULL,
    contract_id uuid NOT NULL,
    coefficient numeric(12,4) NOT NULL,
    CONSTRAINT complex_service_tariff_coefficient_check CHECK ((coefficient > (0)::numeric))
);


--
-- Name: container; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.container (
    id uuid NOT NULL,
    code character varying(100) NOT NULL,
    weight numeric(16,3) DEFAULT 3200.000 NOT NULL,
    container_type character varying(32),
    lifting_capacity numeric(15,3),
    CONSTRAINT ck_container_code_not_blank CHECK ((btrim((code)::text) <> ''::text)),
    CONSTRAINT ck_container_code_trimmed CHECK (((code)::text = btrim((code)::text))),
    CONSTRAINT ck_container_load_capacity CHECK ((lifting_capacity > (0)::numeric)),
    CONSTRAINT ck_container_type CHECK (((container_type IS NULL) OR ((container_type)::text = ANY (ARRAY[('STANDARD_20'::character varying)::text, ('STANDARD_40'::character varying)::text])))),
    CONSTRAINT container_tare_weight_check CHECK ((weight > (0)::numeric))
);


--
-- Name: contract; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract (
    id uuid NOT NULL,
    client_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    CONSTRAINT contract_name_check CHECK (((btrim((name)::text) <> ''::text) AND ((name)::text = btrim((name)::text))))
);


--
-- Name: danger_class; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.danger_class (
    id uuid NOT NULL,
    name character varying(255) NOT NULL
);


--
-- Name: etsng_code; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.etsng_code (
    id uuid NOT NULL,
    code character varying(100) NOT NULL,
    CONSTRAINT ck_etsng_code_code_not_blank CHECK ((btrim((code)::text) <> ''::text)),
    CONSTRAINT ck_etsng_code_code_trimmed CHECK (((code)::text = btrim((code)::text)))
);


--
-- Name: order_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_code_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payer (
    id uuid NOT NULL,
    name character varying(255) NOT NULL
);


--
-- Name: payment_invoice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_invoice (
    id uuid NOT NULL,
    code integer NOT NULL,
    request_key uuid NOT NULL,
    client_id uuid NOT NULL,
    contract_id uuid NOT NULL,
    client_name character varying(255) NOT NULL,
    contract_name character varying(255) NOT NULL,
    billing_month date NOT NULL,
    billing_time_zone character varying(80) NOT NULL,
    status character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    currency character varying(3) NOT NULL,
    amount_without_vat numeric(14,2) NOT NULL,
    amount_with_vat numeric(14,2) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT payment_invoice_amount_without_vat_check CHECK ((amount_without_vat >= (0)::numeric)),
    CONSTRAINT payment_invoice_billing_month_check CHECK ((EXTRACT(day FROM billing_month) = (1)::numeric)),
    CONSTRAINT payment_invoice_check CHECK ((amount_with_vat >= amount_without_vat)),
    CONSTRAINT payment_invoice_currency_check CHECK (((currency)::text = 'RUB'::text)),
    CONSTRAINT payment_invoice_status_check CHECK (((status)::text = 'DRAFT'::text))
);


--
-- Name: payment_invoice_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.payment_invoice ALTER COLUMN code ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.payment_invoice_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: payment_invoice_line; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_invoice_line (
    id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    billing_charge_id uuid NOT NULL,
    performed_at timestamp with time zone NOT NULL,
    service_order_id uuid NOT NULL,
    service_order_code integer NOT NULL,
    container_name character varying(255) NOT NULL,
    service_name text NOT NULL,
    amount_without_vat numeric(14,2) NOT NULL,
    amount_with_vat numeric(14,2) NOT NULL,
    CONSTRAINT payment_invoice_line_amount_without_vat_check CHECK ((amount_without_vat >= (0)::numeric)),
    CONSTRAINT payment_invoice_line_check CHECK ((amount_with_vat >= amount_without_vat))
);


--
-- Name: railway_carriage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.railway_carriage (
    id uuid NOT NULL,
    code character varying(100) NOT NULL,
    type_id uuid,
    model_id uuid,
    lifting_capacity numeric(15,3),
    date_depot_repair date,
    CONSTRAINT ck_railway_carriage_code_not_blank CHECK ((btrim((code)::text) <> ''::text)),
    CONSTRAINT ck_railway_carriage_code_trimmed CHECK (((code)::text = btrim((code)::text))),
    CONSTRAINT railway_carriage_load_capacity_check CHECK ((lifting_capacity > (0)::numeric))
);


--
-- Name: railway_carriage_model; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.railway_carriage_model (
    id uuid NOT NULL,
    code character varying(255) NOT NULL
);


--
-- Name: railway_carriage_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.railway_carriage_type (
    id uuid NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(200) NOT NULL,
    CONSTRAINT ck_railway_carriage_type_code_not_blank CHECK ((btrim((code)::text) <> ''::text)),
    CONSTRAINT ck_railway_carriage_type_name_not_blank CHECK ((btrim((name)::text) <> ''::text))
);


--
-- Name: railway_station; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.railway_station (
    id uuid NOT NULL,
    esr_code character varying(20) NOT NULL
);


--
-- Name: receiving_order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receiving_order (
    id uuid NOT NULL,
    number integer DEFAULT nextval('public.order_code_seq'::regclass) NOT NULL,
    client_id uuid NOT NULL,
    order_status character varying(100) NOT NULL,
    terminal_area_catalog_id uuid NOT NULL,
    transport_type character varying(100),
    contract_id uuid,
    service_order_id uuid,
    route_id uuid,
    service_role character varying(30) DEFAULT 'INITIAL_RECEIVING'::character varying NOT NULL,
    source_shipping_order_id uuid,
    accepted_container_count integer,
    a_complex_service_id uuid,
    acceptance_fixed_at timestamp with time zone,
    legacy_code integer,
    plan_receiving_date_time timestamp without time zone,
    consignor character varying(255),
    CONSTRAINT ck_receiving_order_status CHECK (((order_status)::text = ANY (ARRAY[('DRAFT'::character varying)::text, ('CONFIRMED'::character varying)::text, ('COMPLETED'::character varying)::text]))),
    CONSTRAINT ck_receiving_service_contract CHECK (((service_order_id IS NULL) OR (contract_id IS NOT NULL))),
    CONSTRAINT ck_receiving_service_role CHECK ((((service_order_id IS NULL) AND ((service_role)::text = 'INITIAL_RECEIVING'::text) AND (source_shipping_order_id IS NULL)) OR ((service_order_id IS NOT NULL) AND ((service_role)::text = 'INITIAL_RECEIVING'::text) AND ((transport_type)::text = 'RAILWAY'::text) AND (source_shipping_order_id IS NULL)) OR ((service_order_id IS NOT NULL) AND ((service_role)::text = 'RETURN_RECEIVING'::text) AND ((transport_type)::text = 'VEHICLE'::text) AND (source_shipping_order_id IS NOT NULL)))),
    CONSTRAINT receiving_order_accepted_container_count_check CHECK ((accepted_container_count > 0))
);


--
-- Name: receiving_order_container; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receiving_order_container (
    id uuid NOT NULL,
    receiving_order_id uuid NOT NULL,
    container_id uuid NOT NULL,
    empty boolean DEFAULT false NOT NULL,
    owner_container_id uuid,
    seal_numbers character varying(1000),
    seal_type_id uuid,
    danger_class_id uuid
);


--
-- Name: receiving_order_container_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receiving_order_container_item (
    id uuid NOT NULL,
    receiving_order_container_id uuid NOT NULL,
    etsng_code_id uuid NOT NULL,
    wight_net numeric(15,3) NOT NULL,
    CONSTRAINT ck_receiving_order_item_weight_positive CHECK ((wight_net > (0)::numeric))
);


--
-- Name: route; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.route (
    id uuid NOT NULL,
    number integer NOT NULL,
    route_type character varying(20) NOT NULL,
    data_time timestamp with time zone NOT NULL,
    terminal_area_catalog_id uuid NOT NULL,
    transport_type character varying(20) NOT NULL,
    comment character varying(200),
    status character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    client_related_entity_id uuid,
    client_driver_id uuid,
    client_vehicle_id uuid,
    CONSTRAINT ck_vehicle_route_details CHECK ((((transport_type)::text <> 'VEHICLE'::text) OR ((client_related_entity_id IS NOT NULL) AND (client_driver_id IS NOT NULL) AND (client_vehicle_id IS NOT NULL)))),
    CONSTRAINT route_route_type_check CHECK (((route_type)::text = ANY (ARRAY[('RECEIVING'::character varying)::text, ('SHIPPING'::character varying)::text]))),
    CONSTRAINT route_status_check CHECK (((status)::text = ANY (ARRAY[('DRAFT'::character varying)::text, ('CONFIRMED'::character varying)::text, ('COMPLETED'::character varying)::text]))),
    CONSTRAINT route_transport_type_check CHECK (((transport_type)::text = ANY (ARRAY[('VEHICLE'::character varying)::text, ('RAILWAY'::character varying)::text])))
);


--
-- Name: route_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.route ALTER COLUMN number ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.route_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: seal_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seal_type (
    id uuid NOT NULL,
    code character varying(255) NOT NULL
);


--
-- Name: service_execution; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_execution (
    id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    container_id uuid NOT NULL,
    family character varying(1) NOT NULL,
    complex_service_id uuid NOT NULL,
    receiving_order_id uuid NOT NULL,
    shipping_order_id uuid NOT NULL,
    status character varying(20) NOT NULL,
    performed_at timestamp with time zone,
    tariff_id uuid,
    coefficient numeric(12,4),
    base_price_without_vat numeric(14,2),
    base_price_with_vat numeric(14,2),
    price_without_vat numeric(14,2),
    price_with_vat numeric(14,2),
    priced_at timestamp with time zone,
    accepted_container_count integer,
    CONSTRAINT service_execution_check CHECK ((((priced_at IS NULL) AND (tariff_id IS NULL) AND (coefficient IS NULL) AND (base_price_without_vat IS NULL) AND (base_price_with_vat IS NULL) AND (price_without_vat IS NULL) AND (price_with_vat IS NULL)) OR ((priced_at IS NOT NULL) AND (tariff_id IS NOT NULL) AND (coefficient > (0)::numeric) AND (base_price_without_vat >= (0)::numeric) AND (base_price_with_vat >= base_price_without_vat) AND (price_without_vat >= (0)::numeric) AND (price_with_vat >= price_without_vat)))),
    CONSTRAINT service_execution_check1 CHECK ((((status)::text <> 'PERFORMED'::text) OR ((performed_at IS NOT NULL) AND (priced_at IS NOT NULL)))),
    CONSTRAINT service_execution_family_check CHECK (((family)::text = ANY (ARRAY[('A'::character varying)::text, ('B'::character varying)::text]))),
    CONSTRAINT service_execution_status_check CHECK (((status)::text = ANY (ARRAY[('PLANNED'::character varying)::text, ('PERFORMED'::character varying)::text])))
);


--
-- Name: service_order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order (
    id uuid NOT NULL,
    code integer DEFAULT nextval('public.order_code_seq'::regclass) NOT NULL,
    client_id uuid NOT NULL,
    contract_id uuid NOT NULL,
    status character varying(30) DEFAULT 'DRAFT'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    legacy_code integer,
    CONSTRAINT service_order_status_check CHECK (((status)::text = ANY (ARRAY[('DRAFT'::character varying)::text, ('CONFIRMED'::character varying)::text, ('COMPLETED'::character varying)::text])))
);


--
-- Name: shipping_order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_order (
    id uuid NOT NULL,
    number integer DEFAULT nextval('public.order_code_seq'::regclass) NOT NULL,
    client_id uuid NOT NULL,
    order_status character varying(100) NOT NULL,
    terminal_area_catalog_id uuid NOT NULL,
    transport_type character varying(100) NOT NULL,
    filling_type character varying(32) DEFAULT 'ALL'::character varying NOT NULL,
    contract_id uuid,
    service_order_id uuid,
    source_receiving_order_id uuid,
    route_id uuid,
    legacy_code integer,
    planned_shipping_date_time timestamp without time zone,
    consignee_id uuid,
    CONSTRAINT ck_shipping_order_filling_type CHECK (((filling_type)::text = ANY (ARRAY[('ALL'::character varying)::text, ('RAILWAY_CARRIAGE'::character varying)::text, ('CONTAINER'::character varying)::text, ('NONE'::character varying)::text, ('VEHICLE_UNNUMBERED'::character varying)::text]))),
    CONSTRAINT ck_shipping_order_status CHECK (((order_status)::text = ANY (ARRAY[('DRAFT'::character varying)::text, ('CONFIRMED'::character varying)::text, ('COMPLETED'::character varying)::text]))),
    CONSTRAINT ck_shipping_order_transport_type CHECK (((transport_type)::text = ANY (ARRAY[('VEHICLE'::character varying)::text, ('RAILWAY'::character varying)::text]))),
    CONSTRAINT ck_shipping_service_context CHECK ((((service_order_id IS NULL) AND (source_receiving_order_id IS NULL)) OR ((service_order_id IS NOT NULL) AND (source_receiving_order_id IS NOT NULL) AND (contract_id IS NOT NULL) AND ((transport_type)::text = 'VEHICLE'::text) AND ((filling_type)::text = 'ALL'::text))))
);


--
-- Name: shipping_order_container; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_order_container (
    id uuid NOT NULL,
    shipping_order_id uuid NOT NULL,
    container_id uuid NOT NULL,
    empty boolean DEFAULT false NOT NULL,
    shipping_order_railway_carriage_id uuid,
    owner_container_id uuid,
    seal_numbers character varying(1000),
    seal_type_id uuid,
    danger_class_id uuid
);


--
-- Name: shipping_order_container_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_order_container_item (
    id uuid NOT NULL,
    shipping_order_container_id uuid NOT NULL,
    etsng_code_id uuid NOT NULL,
    wight_net numeric(15,3) NOT NULL,
    CONSTRAINT ck_shipping_order_item_weight_positive CHECK ((wight_net > (0)::numeric))
);


--
-- Name: shipping_order_container_qty; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_order_container_qty (
    id uuid NOT NULL,
    shipping_order_id uuid NOT NULL,
    quantity integer NOT NULL,
    type character varying(20) NOT NULL,
    empty boolean DEFAULT false NOT NULL,
    CONSTRAINT ck_shipping_order_container_qty_positive CHECK ((quantity > 0)),
    CONSTRAINT ck_shipping_order_container_qty_type CHECK (((type)::text = ANY (ARRAY[('STANDARD_20'::character varying)::text, ('STANDARD_40'::character varying)::text])))
);


--
-- Name: shipping_order_etsng_code; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_order_etsng_code (
    id uuid NOT NULL,
    shipping_order_container_qty_id uuid NOT NULL,
    etsng_code_id uuid NOT NULL,
    weight numeric(16,3) NOT NULL,
    CONSTRAINT ck_shipping_order_etsng_weight_positive CHECK ((weight > (0)::numeric))
);


--
-- Name: shipping_order_railway_carriage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_order_railway_carriage (
    id uuid NOT NULL,
    shipping_order_id uuid NOT NULL,
    railway_carriage_id uuid NOT NULL
);


--
-- Name: shipping_order_railway_carriage_qty; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_order_railway_carriage_qty (
    id uuid NOT NULL,
    shipping_order_id uuid NOT NULL,
    quantity integer NOT NULL,
    type_id uuid,
    CONSTRAINT ck_shipping_order_carriage_qty_positive CHECK ((quantity > 0))
);


--
-- Name: shipping_order_source_container; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_order_source_container (
    shipping_order_id uuid NOT NULL,
    service_order_id uuid NOT NULL,
    container_id uuid NOT NULL
);


--
-- Name: terminal_area_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.terminal_area_catalog (
    id uuid NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    CONSTRAINT ck_terminal_area_code_not_blank CHECK ((btrim((code)::text) <> ''::text)),
    CONSTRAINT ck_terminal_area_code_trimmed CHECK (((code)::text = btrim((code)::text))),
    CONSTRAINT ck_terminal_area_name_not_blank CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT ck_terminal_area_name_trimmed CHECK (((name)::text = btrim((name)::text)))
);


--
-- Name: waybill_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.waybill_number_seq
    START WITH 1743125934
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: waybill; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waybill (
    id uuid NOT NULL,
    number character varying(255) DEFAULT (nextval('public.waybill_number_seq'::regclass))::text NOT NULL,
    receiving_order_id uuid,
    departure_station_id uuid NOT NULL,
    destination_station_id uuid NOT NULL,
    payer_id uuid NOT NULL,
    CONSTRAINT ck_waybill_number_not_blank CHECK ((btrim((number)::text) <> ''::text)),
    CONSTRAINT ck_waybill_number_trimmed CHECK (((number)::text = btrim((number)::text)))
);


--
-- Name: waybill_container; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waybill_container (
    id uuid NOT NULL,
    waybill_railway_carriage_id uuid NOT NULL,
    container_id uuid NOT NULL,
    weight numeric(16,3) NOT NULL,
    net_weight numeric(16,3) NOT NULL,
    owner character varying(255),
    CONSTRAINT waybill_container_check CHECK (((net_weight >= (0)::numeric) AND (net_weight <= weight))),
    CONSTRAINT waybill_container_gross_weight_check CHECK ((weight > (0)::numeric))
);


--
-- Name: waybill_zpu; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waybill_zpu (
    id uuid NOT NULL,
    waybill_container_id uuid NOT NULL,
    zpu character varying(1000) NOT NULL,
    zpu_type character varying(255),
    CONSTRAINT waybill_zpu_zpu_check CHECK ((btrim((zpu)::text) <> ''::text))
);


--
-- Name: waybill_container_details; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.waybill_container_details AS
 SELECT wc.id,
    wc.waybill_railway_carriage_id,
    wc.container_id,
    wc.weight,
    wc.net_weight,
    wc.owner,
    c.id AS owner_container_id,
    wc.owner AS owner_container_name,
    z.seal_numbers,
    st.id AS seal_type_id,
    z.zpu_type AS seal_type_name
   FROM (((public.waybill_container wc
     LEFT JOIN public.client_related_entity c ON (((c.name)::text = (wc.owner)::text)))
     LEFT JOIN LATERAL ( SELECT string_agg((waybill_zpu.zpu)::text, ', '::text ORDER BY (waybill_zpu.zpu)::text) AS seal_numbers,
            min((waybill_zpu.zpu_type)::text) AS zpu_type
           FROM public.waybill_zpu
          WHERE (waybill_zpu.waybill_container_id = wc.id)) z ON (true))
     LEFT JOIN public.seal_type st ON (((st.code)::text = z.zpu_type)));


--
-- Name: waybill_details; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.waybill_details AS
 SELECT w.id,
    w.number,
    w.receiving_order_id,
    w.departure_station_id,
    w.destination_station_id,
    w.payer_id,
    (ds.esr_code)::integer AS departure_station,
    (ts.esr_code)::integer AS destination_station,
    p.name AS payer
   FROM (((public.waybill w
     JOIN public.railway_station ds ON ((ds.id = w.departure_station_id)))
     JOIN public.railway_station ts ON ((ts.id = w.destination_station_id)))
     JOIN public.payer p ON ((p.id = w.payer_id)));


--
-- Name: waybill_product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waybill_product (
    id uuid NOT NULL,
    waybill_id uuid NOT NULL,
    etsng_code_id uuid NOT NULL,
    sign_danger character varying(255),
    weight numeric(16,3) NOT NULL,
    CONSTRAINT waybill_product_weight_check CHECK ((weight >= (0)::numeric))
);


--
-- Name: waybill_product_details; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.waybill_product_details AS
 SELECT p.id,
    p.waybill_id,
    p.etsng_code_id,
    p.sign_danger,
    p.weight,
    h.id AS danger_class_id,
    p.sign_danger AS danger_class_name
   FROM (public.waybill_product p
     LEFT JOIN public.danger_class h ON (((h.name)::text = (p.sign_danger)::text)));


--
-- Name: waybill_railway_carriage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waybill_railway_carriage (
    id uuid NOT NULL,
    waybill_id uuid NOT NULL,
    railway_carriage_id uuid NOT NULL
);


--
-- Name: billing_charge billing_charge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_charge
    ADD CONSTRAINT billing_charge_pkey PRIMARY KEY (id);


--
-- Name: billing_charge billing_charge_service_execution_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_charge
    ADD CONSTRAINT billing_charge_service_execution_id_key UNIQUE (service_execution_id);


--
-- Name: receiving_order ck_receiving_order_transport_type; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.receiving_order
    ADD CONSTRAINT ck_receiving_order_transport_type CHECK (((transport_type IS NOT NULL) AND ((transport_type)::text = ANY (ARRAY[('VEHICLE'::character varying)::text, ('RAILWAY'::character varying)::text])))) NOT VALID;


--
-- Name: client_driver client_driver_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_driver
    ADD CONSTRAINT client_driver_code_key UNIQUE (code);


--
-- Name: client_driver client_driver_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_driver
    ADD CONSTRAINT client_driver_pkey PRIMARY KEY (id);


--
-- Name: client client_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client
    ADD CONSTRAINT client_pkey PRIMARY KEY (id);


--
-- Name: client_related_entity client_related_entity_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_related_entity
    ADD CONSTRAINT client_related_entity_name_key UNIQUE (name);


--
-- Name: client_related_entity client_related_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_related_entity
    ADD CONSTRAINT client_related_entity_pkey PRIMARY KEY (id);


--
-- Name: client_vehicle client_vehicle_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_vehicle
    ADD CONSTRAINT client_vehicle_code_key UNIQUE (code);


--
-- Name: client_vehicle client_vehicle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_vehicle
    ADD CONSTRAINT client_vehicle_pkey PRIMARY KEY (id);


--
-- Name: complex_service_catalog complex_service_catalog_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complex_service_catalog
    ADD CONSTRAINT complex_service_catalog_name_key UNIQUE (name);


--
-- Name: complex_service_catalog complex_service_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complex_service_catalog
    ADD CONSTRAINT complex_service_catalog_pkey PRIMARY KEY (id);


--
-- Name: complex_service_catalog complex_service_catalog_purpose_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complex_service_catalog
    ADD CONSTRAINT complex_service_catalog_purpose_key UNIQUE (purpose);


--
-- Name: complex_service_tariff complex_service_tariff_complex_service_id_contract_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complex_service_tariff
    ADD CONSTRAINT complex_service_tariff_complex_service_id_contract_id_key UNIQUE (complex_service_id, contract_id);


--
-- Name: complex_service_tariff complex_service_tariff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complex_service_tariff
    ADD CONSTRAINT complex_service_tariff_pkey PRIMARY KEY (id);


--
-- Name: container container_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.container
    ADD CONSTRAINT container_pkey PRIMARY KEY (id);


--
-- Name: contract contract_client_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract
    ADD CONSTRAINT contract_client_id_name_key UNIQUE (client_id, name);


--
-- Name: contract contract_id_client_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract
    ADD CONSTRAINT contract_id_client_id_key UNIQUE (id, client_id);


--
-- Name: contract contract_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract
    ADD CONSTRAINT contract_pkey PRIMARY KEY (id);


--
-- Name: etsng_code etsng_code_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etsng_code
    ADD CONSTRAINT etsng_code_pkey PRIMARY KEY (id);


--
-- Name: danger_class hazard_class_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.danger_class
    ADD CONSTRAINT hazard_class_code_key UNIQUE (name);


--
-- Name: danger_class hazard_class_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.danger_class
    ADD CONSTRAINT hazard_class_pkey PRIMARY KEY (id);


--
-- Name: payer payer_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payer
    ADD CONSTRAINT payer_name_key UNIQUE (name);


--
-- Name: payer payer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payer
    ADD CONSTRAINT payer_pkey PRIMARY KEY (id);


--
-- Name: payment_invoice payment_invoice_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_invoice
    ADD CONSTRAINT payment_invoice_code_key UNIQUE (code);


--
-- Name: payment_invoice_line payment_invoice_line_billing_charge_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_invoice_line
    ADD CONSTRAINT payment_invoice_line_billing_charge_id_key UNIQUE (billing_charge_id);


--
-- Name: payment_invoice_line payment_invoice_line_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_invoice_line
    ADD CONSTRAINT payment_invoice_line_pkey PRIMARY KEY (id);


--
-- Name: payment_invoice payment_invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_invoice
    ADD CONSTRAINT payment_invoice_pkey PRIMARY KEY (id);


--
-- Name: payment_invoice payment_invoice_request_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_invoice
    ADD CONSTRAINT payment_invoice_request_key_key UNIQUE (request_key);


--
-- Name: railway_carriage_model railway_carriage_model_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.railway_carriage_model
    ADD CONSTRAINT railway_carriage_model_code_key UNIQUE (code);


--
-- Name: railway_carriage_model railway_carriage_model_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.railway_carriage_model
    ADD CONSTRAINT railway_carriage_model_pkey PRIMARY KEY (id);


--
-- Name: railway_carriage railway_carriage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.railway_carriage
    ADD CONSTRAINT railway_carriage_pkey PRIMARY KEY (id);


--
-- Name: railway_carriage_type railway_carriage_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.railway_carriage_type
    ADD CONSTRAINT railway_carriage_type_pkey PRIMARY KEY (id);


--
-- Name: railway_station railway_station_esr_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.railway_station
    ADD CONSTRAINT railway_station_esr_code_key UNIQUE (esr_code);


--
-- Name: railway_station railway_station_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.railway_station
    ADD CONSTRAINT railway_station_pkey PRIMARY KEY (id);


--
-- Name: receiving_order_container_item receiving_order_container_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_order_container_item
    ADD CONSTRAINT receiving_order_container_item_pkey PRIMARY KEY (id);


--
-- Name: receiving_order_container receiving_order_container_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_order_container
    ADD CONSTRAINT receiving_order_container_pkey PRIMARY KEY (id);


--
-- Name: receiving_order receiving_order_id_service_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_order
    ADD CONSTRAINT receiving_order_id_service_order_id_key UNIQUE (id, service_order_id);


--
-- Name: receiving_order receiving_order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_order
    ADD CONSTRAINT receiving_order_pkey PRIMARY KEY (id);


--
-- Name: route route_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route
    ADD CONSTRAINT route_code_key UNIQUE (number);


--
-- Name: route route_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route
    ADD CONSTRAINT route_pkey PRIMARY KEY (id);


--
-- Name: seal_type seal_type_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seal_type
    ADD CONSTRAINT seal_type_code_key UNIQUE (code);


--
-- Name: seal_type seal_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seal_type
    ADD CONSTRAINT seal_type_pkey PRIMARY KEY (id);


--
-- Name: service_execution service_execution_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_execution
    ADD CONSTRAINT service_execution_pkey PRIMARY KEY (id);


--
-- Name: service_execution service_execution_service_order_id_container_id_family_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_execution
    ADD CONSTRAINT service_execution_service_order_id_container_id_family_key UNIQUE (service_order_id, container_id, family);


--
-- Name: service_order service_order_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order
    ADD CONSTRAINT service_order_code_key UNIQUE (code);


--
-- Name: service_order service_order_id_client_id_contract_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order
    ADD CONSTRAINT service_order_id_client_id_contract_id_key UNIQUE (id, client_id, contract_id);


--
-- Name: service_order service_order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order
    ADD CONSTRAINT service_order_pkey PRIMARY KEY (id);


--
-- Name: shipping_order_container_item shipping_order_container_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_container_item
    ADD CONSTRAINT shipping_order_container_item_pkey PRIMARY KEY (id);


--
-- Name: shipping_order_container shipping_order_container_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_container
    ADD CONSTRAINT shipping_order_container_pkey PRIMARY KEY (id);


--
-- Name: shipping_order_container_qty shipping_order_container_qty_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_container_qty
    ADD CONSTRAINT shipping_order_container_qty_pkey PRIMARY KEY (id);


--
-- Name: shipping_order_etsng_code shipping_order_etsng_code_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_etsng_code
    ADD CONSTRAINT shipping_order_etsng_code_pkey PRIMARY KEY (id);


--
-- Name: shipping_order shipping_order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order
    ADD CONSTRAINT shipping_order_pkey PRIMARY KEY (id);


--
-- Name: shipping_order_railway_carriage shipping_order_railway_carriage_new_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_railway_carriage
    ADD CONSTRAINT shipping_order_railway_carriage_new_pkey PRIMARY KEY (id);


--
-- Name: shipping_order_railway_carriage_qty shipping_order_railway_carriage_qty_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_railway_carriage_qty
    ADD CONSTRAINT shipping_order_railway_carriage_qty_pkey PRIMARY KEY (id);


--
-- Name: shipping_order_source_container shipping_order_source_contain_service_order_id_container_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_source_container
    ADD CONSTRAINT shipping_order_source_contain_service_order_id_container_id_key UNIQUE (service_order_id, container_id);


--
-- Name: shipping_order_source_container shipping_order_source_container_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_source_container
    ADD CONSTRAINT shipping_order_source_container_pkey PRIMARY KEY (shipping_order_id, container_id);


--
-- Name: terminal_area_catalog terminal_area_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terminal_area_catalog
    ADD CONSTRAINT terminal_area_catalog_pkey PRIMARY KEY (id);


--
-- Name: receiving_order uq_receiving_order_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_order
    ADD CONSTRAINT uq_receiving_order_code UNIQUE (number);


--
-- Name: receiving_order_container uq_receiving_order_container; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_order_container
    ADD CONSTRAINT uq_receiving_order_container UNIQUE (receiving_order_id, container_id);


--
-- Name: shipping_order_railway_carriage_qty uq_shipping_order_carriage_qty_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_railway_carriage_qty
    ADD CONSTRAINT uq_shipping_order_carriage_qty_type UNIQUE NULLS NOT DISTINCT (shipping_order_id, type_id);


--
-- Name: shipping_order uq_shipping_order_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order
    ADD CONSTRAINT uq_shipping_order_code UNIQUE (number);


--
-- Name: shipping_order_container uq_shipping_order_container; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_container
    ADD CONSTRAINT uq_shipping_order_container UNIQUE (shipping_order_id, container_id);


--
-- Name: shipping_order_container uq_shipping_order_container_order_and_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_container
    ADD CONSTRAINT uq_shipping_order_container_order_and_id UNIQUE (shipping_order_id, id);


--
-- Name: shipping_order_etsng_code uq_shipping_order_etsng_row; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_etsng_code
    ADD CONSTRAINT uq_shipping_order_etsng_row UNIQUE (shipping_order_container_qty_id, etsng_code_id, weight);


--
-- Name: shipping_order uq_shipping_order_id_service; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order
    ADD CONSTRAINT uq_shipping_order_id_service UNIQUE (id, service_order_id);


--
-- Name: shipping_order_railway_carriage uq_shipping_order_numbered_carriage; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_railway_carriage
    ADD CONSTRAINT uq_shipping_order_numbered_carriage UNIQUE (shipping_order_id, railway_carriage_id);


--
-- Name: shipping_order_railway_carriage uq_shipping_order_numbered_carriage_order_and_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_railway_carriage
    ADD CONSTRAINT uq_shipping_order_numbered_carriage_order_and_id UNIQUE (shipping_order_id, id);


--
-- Name: terminal_area_catalog uq_terminal_area_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terminal_area_catalog
    ADD CONSTRAINT uq_terminal_area_code UNIQUE (code);


--
-- Name: waybill_container waybill_container_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waybill_container
    ADD CONSTRAINT waybill_container_pkey PRIMARY KEY (id);


--
-- Name: waybill waybill_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waybill
    ADD CONSTRAINT waybill_pkey PRIMARY KEY (id);


--
-- Name: waybill_product waybill_product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waybill_product
    ADD CONSTRAINT waybill_product_pkey PRIMARY KEY (id);


--
-- Name: waybill_railway_carriage waybill_railway_carriage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waybill_railway_carriage
    ADD CONSTRAINT waybill_railway_carriage_pkey PRIMARY KEY (id);


--
-- Name: waybill_zpu waybill_zpu_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waybill_zpu
    ADD CONSTRAINT waybill_zpu_pkey PRIMARY KEY (id);


--
-- Name: ix_charge_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_charge_date ON public.billing_charge USING btree (performed_at);


--
-- Name: ix_charge_invoice_filter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_charge_invoice_filter ON public.billing_charge USING btree (client_id, contract_id, performed_at);


--
-- Name: ix_complex_service_tariff_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_complex_service_tariff_client ON public.complex_service_tariff USING btree (client_id);


--
-- Name: ix_container_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_container_type ON public.container USING btree (container_type);


--
-- Name: ix_execution_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_execution_service ON public.service_execution USING btree (service_order_id);


--
-- Name: ix_invoice_client_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_invoice_client_contract ON public.payment_invoice USING btree (client_id, contract_id, code DESC);


--
-- Name: ix_invoice_line_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_invoice_line_invoice ON public.payment_invoice_line USING btree (invoice_id);


--
-- Name: ix_railway_carriage_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_railway_carriage_type_id ON public.railway_carriage USING btree (type_id);


--
-- Name: ix_receiving_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_receiving_contract ON public.receiving_order USING btree (contract_id);


--
-- Name: ix_receiving_order_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_receiving_order_client_id ON public.receiving_order USING btree (client_id);


--
-- Name: ix_receiving_order_code_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_receiving_order_code_desc ON public.receiving_order USING btree (number DESC);


--
-- Name: ix_receiving_order_container_container_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_receiving_order_container_container_id ON public.receiving_order_container USING btree (container_id);


--
-- Name: ix_receiving_order_container_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_receiving_order_container_order_id ON public.receiving_order_container USING btree (receiving_order_id);


--
-- Name: ix_receiving_order_item_etsng_code_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_receiving_order_item_etsng_code_id ON public.receiving_order_container_item USING btree (etsng_code_id);


--
-- Name: ix_receiving_order_route; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_receiving_order_route ON public.receiving_order USING btree (route_id);


--
-- Name: ix_receiving_order_terminal_area_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_receiving_order_terminal_area_id ON public.receiving_order USING btree (terminal_area_catalog_id);


--
-- Name: ix_service_order_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_service_order_code ON public.service_order USING btree (code DESC);


--
-- Name: ix_shipping_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shipping_contract ON public.shipping_order USING btree (contract_id);


--
-- Name: ix_shipping_order_carriage_qty_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shipping_order_carriage_qty_order_id ON public.shipping_order_railway_carriage_qty USING btree (shipping_order_id);


--
-- Name: ix_shipping_order_carriage_qty_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shipping_order_carriage_qty_type_id ON public.shipping_order_railway_carriage_qty USING btree (type_id);


--
-- Name: ix_shipping_order_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shipping_order_client_id ON public.shipping_order USING btree (client_id);


--
-- Name: ix_shipping_order_code_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shipping_order_code_desc ON public.shipping_order USING btree (number DESC);


--
-- Name: ix_shipping_order_container_container_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shipping_order_container_container_id ON public.shipping_order_container USING btree (container_id);


--
-- Name: ix_shipping_order_container_numbered_carriage_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shipping_order_container_numbered_carriage_id ON public.shipping_order_container USING btree (shipping_order_railway_carriage_id);


--
-- Name: ix_shipping_order_container_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shipping_order_container_order_id ON public.shipping_order_container USING btree (shipping_order_id);


--
-- Name: ix_shipping_order_container_qty_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shipping_order_container_qty_order_id ON public.shipping_order_container_qty USING btree (shipping_order_id);


--
-- Name: ix_shipping_order_etsng_code_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shipping_order_etsng_code_id ON public.shipping_order_etsng_code USING btree (etsng_code_id);


--
-- Name: ix_shipping_order_etsng_container_qty_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shipping_order_etsng_container_qty_id ON public.shipping_order_etsng_code USING btree (shipping_order_container_qty_id);


--
-- Name: ix_shipping_order_item_etsng_code_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shipping_order_item_etsng_code_id ON public.shipping_order_container_item USING btree (etsng_code_id);


--
-- Name: ix_shipping_order_numbered_carriage_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shipping_order_numbered_carriage_order_id ON public.shipping_order_railway_carriage USING btree (shipping_order_id);


--
-- Name: ix_shipping_order_numbered_carriage_reference_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shipping_order_numbered_carriage_reference_id ON public.shipping_order_railway_carriage USING btree (railway_carriage_id);


--
-- Name: ix_shipping_order_route; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shipping_order_route ON public.shipping_order USING btree (route_id);


--
-- Name: ix_shipping_order_source_container_container; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shipping_order_source_container_container ON public.shipping_order_source_container USING btree (container_id);


--
-- Name: ix_shipping_order_terminal_area_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shipping_order_terminal_area_id ON public.shipping_order USING btree (terminal_area_catalog_id);


--
-- Name: ix_shipping_source_receiving; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shipping_source_receiving ON public.shipping_order USING btree (source_receiving_order_id);


--
-- Name: ix_waybill_container_carriage_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_waybill_container_carriage_id ON public.waybill_container USING btree (waybill_railway_carriage_id);


--
-- Name: ix_waybill_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_waybill_group ON public.waybill USING btree (departure_station_id, destination_station_id, payer_id);


--
-- Name: ix_waybill_product_waybill_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_waybill_product_waybill_id ON public.waybill_product USING btree (waybill_id);


--
-- Name: ix_waybill_railway_carriage_waybill_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_waybill_railway_carriage_waybill_id ON public.waybill_railway_carriage USING btree (waybill_id);


--
-- Name: ix_waybill_receiving_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_waybill_receiving_order_id ON public.waybill USING btree (receiving_order_id);


--
-- Name: ix_waybill_zpu_container; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_waybill_zpu_container ON public.waybill_zpu USING btree (waybill_container_id);


--
-- Name: uq_client_code_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_client_code_ci ON public.client USING btree (lower(btrim((name)::text)));


--
-- Name: uq_container_code_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_container_code_ci ON public.container USING btree (lower(btrim((code)::text)));


--
-- Name: uq_etsng_code_code_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_etsng_code_code_ci ON public.etsng_code USING btree (lower(btrim((code)::text)));


--
-- Name: uq_railway_carriage_code_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_railway_carriage_code_ci ON public.railway_carriage USING btree (lower(btrim((code)::text)));


--
-- Name: uq_railway_carriage_type_code_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_railway_carriage_type_code_ci ON public.railway_carriage_type USING btree (lower(btrim((code)::text)));


--
-- Name: uq_receiving_initial_per_service; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_receiving_initial_per_service ON public.receiving_order USING btree (service_order_id) WHERE ((service_order_id IS NOT NULL) AND ((service_role)::text = 'INITIAL_RECEIVING'::text));


--
-- Name: uq_receiving_return_per_shipping; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_receiving_return_per_shipping ON public.receiving_order USING btree (source_shipping_order_id) WHERE ((service_role)::text = 'RETURN_RECEIVING'::text);


--
-- Name: uq_shipping_order_empty_container_qty_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_shipping_order_empty_container_qty_type ON public.shipping_order_container_qty USING btree (shipping_order_id, type) WHERE empty;


--
-- Name: uq_waybill_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_waybill_number ON public.waybill USING btree (number);


--
-- Name: billing_charge billing_charge_contract_id_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_charge
    ADD CONSTRAINT billing_charge_contract_id_client_id_fkey FOREIGN KEY (contract_id, client_id) REFERENCES public.contract(id, client_id) ON DELETE RESTRICT;


--
-- Name: billing_charge billing_charge_service_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_charge
    ADD CONSTRAINT billing_charge_service_execution_id_fkey FOREIGN KEY (service_execution_id) REFERENCES public.service_execution(id) ON DELETE RESTRICT;


--
-- Name: complex_service_tariff complex_service_tariff_complex_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complex_service_tariff
    ADD CONSTRAINT complex_service_tariff_complex_service_id_fkey FOREIGN KEY (complex_service_id) REFERENCES public.complex_service_catalog(id) ON DELETE CASCADE;


--
-- Name: complex_service_tariff complex_service_tariff_contract_id_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complex_service_tariff
    ADD CONSTRAINT complex_service_tariff_contract_id_client_id_fkey FOREIGN KEY (contract_id, client_id) REFERENCES public.contract(id, client_id) ON DELETE RESTRICT;


--
-- Name: contract contract_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract
    ADD CONSTRAINT contract_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.client(id) ON DELETE RESTRICT;


--
-- Name: railway_carriage fk_railway_carriage_type; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.railway_carriage
    ADD CONSTRAINT fk_railway_carriage_type FOREIGN KEY (type_id) REFERENCES public.railway_carriage_type(id) ON DELETE RESTRICT;


--
-- Name: receiving_order fk_receiving_order_terminal_area; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_order
    ADD CONSTRAINT fk_receiving_order_terminal_area FOREIGN KEY (terminal_area_catalog_id) REFERENCES public.terminal_area_catalog(id) ON DELETE RESTRICT;


--
-- Name: receiving_order fk_receiving_return_source; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_order
    ADD CONSTRAINT fk_receiving_return_source FOREIGN KEY (source_shipping_order_id, service_order_id) REFERENCES public.shipping_order(id, service_order_id) ON DELETE RESTRICT;


--
-- Name: shipping_order_container fk_shipping_order_container_numbered_carriage; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_container
    ADD CONSTRAINT fk_shipping_order_container_numbered_carriage FOREIGN KEY (shipping_order_id, shipping_order_railway_carriage_id) REFERENCES public.shipping_order_railway_carriage(shipping_order_id, id) ON DELETE SET NULL (shipping_order_railway_carriage_id);


--
-- Name: shipping_order fk_shipping_order_terminal_area; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order
    ADD CONSTRAINT fk_shipping_order_terminal_area FOREIGN KEY (terminal_area_catalog_id) REFERENCES public.terminal_area_catalog(id) ON DELETE RESTRICT;


--
-- Name: payment_invoice payment_invoice_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_invoice
    ADD CONSTRAINT payment_invoice_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.client(id) ON DELETE RESTRICT;


--
-- Name: payment_invoice payment_invoice_contract_id_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_invoice
    ADD CONSTRAINT payment_invoice_contract_id_client_id_fkey FOREIGN KEY (contract_id, client_id) REFERENCES public.contract(id, client_id) ON DELETE RESTRICT;


--
-- Name: payment_invoice_line payment_invoice_line_billing_charge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_invoice_line
    ADD CONSTRAINT payment_invoice_line_billing_charge_id_fkey FOREIGN KEY (billing_charge_id) REFERENCES public.billing_charge(id) ON DELETE RESTRICT;


--
-- Name: payment_invoice_line payment_invoice_line_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_invoice_line
    ADD CONSTRAINT payment_invoice_line_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.payment_invoice(id) ON DELETE CASCADE;


--
-- Name: payment_invoice_line payment_invoice_line_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_invoice_line
    ADD CONSTRAINT payment_invoice_line_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_order(id) ON DELETE RESTRICT;


--
-- Name: railway_carriage railway_carriage_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.railway_carriage
    ADD CONSTRAINT railway_carriage_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.railway_carriage_model(id) ON DELETE RESTRICT;


--
-- Name: receiving_order receiving_order_a_complex_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_order
    ADD CONSTRAINT receiving_order_a_complex_service_id_fkey FOREIGN KEY (a_complex_service_id) REFERENCES public.complex_service_catalog(id) ON DELETE RESTRICT;


--
-- Name: receiving_order receiving_order_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_order
    ADD CONSTRAINT receiving_order_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.client(id) ON DELETE RESTRICT;


--
-- Name: receiving_order_container receiving_order_container_container_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_order_container
    ADD CONSTRAINT receiving_order_container_container_id_fkey FOREIGN KEY (container_id) REFERENCES public.container(id) ON DELETE RESTRICT;


--
-- Name: receiving_order_container receiving_order_container_hazard_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_order_container
    ADD CONSTRAINT receiving_order_container_hazard_class_id_fkey FOREIGN KEY (danger_class_id) REFERENCES public.danger_class(id) ON DELETE RESTRICT;


--
-- Name: receiving_order_container_item receiving_order_container_ite_receiving_order_container_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_order_container_item
    ADD CONSTRAINT receiving_order_container_ite_receiving_order_container_id_fkey FOREIGN KEY (receiving_order_container_id) REFERENCES public.receiving_order_container(id) ON DELETE CASCADE;


--
-- Name: receiving_order_container_item receiving_order_container_item_etsng_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_order_container_item
    ADD CONSTRAINT receiving_order_container_item_etsng_code_id_fkey FOREIGN KEY (etsng_code_id) REFERENCES public.etsng_code(id) ON DELETE RESTRICT;


--
-- Name: receiving_order_container receiving_order_container_owner_container_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_order_container
    ADD CONSTRAINT receiving_order_container_owner_container_id_fkey FOREIGN KEY (owner_container_id) REFERENCES public.client_related_entity(id);


--
-- Name: receiving_order_container receiving_order_container_receiving_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_order_container
    ADD CONSTRAINT receiving_order_container_receiving_order_id_fkey FOREIGN KEY (receiving_order_id) REFERENCES public.receiving_order(id) ON DELETE CASCADE;


--
-- Name: receiving_order_container receiving_order_container_seal_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_order_container
    ADD CONSTRAINT receiving_order_container_seal_type_id_fkey FOREIGN KEY (seal_type_id) REFERENCES public.seal_type(id) ON DELETE RESTRICT;


--
-- Name: receiving_order receiving_order_contract_id_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_order
    ADD CONSTRAINT receiving_order_contract_id_client_id_fkey FOREIGN KEY (contract_id, client_id) REFERENCES public.contract(id, client_id) ON DELETE RESTRICT;


--
-- Name: receiving_order receiving_order_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_order
    ADD CONSTRAINT receiving_order_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.route(id) ON DELETE RESTRICT;


--
-- Name: receiving_order receiving_order_service_order_id_client_id_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_order
    ADD CONSTRAINT receiving_order_service_order_id_client_id_contract_id_fkey FOREIGN KEY (service_order_id, client_id, contract_id) REFERENCES public.service_order(id, client_id, contract_id) ON DELETE RESTRICT;


--
-- Name: route route_client_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route
    ADD CONSTRAINT route_client_driver_id_fkey FOREIGN KEY (client_driver_id) REFERENCES public.client_driver(id);


--
-- Name: route route_client_related_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route
    ADD CONSTRAINT route_client_related_entity_id_fkey FOREIGN KEY (client_related_entity_id) REFERENCES public.client_related_entity(id);


--
-- Name: route route_client_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route
    ADD CONSTRAINT route_client_vehicle_id_fkey FOREIGN KEY (client_vehicle_id) REFERENCES public.client_vehicle(id);


--
-- Name: route route_terminal_area_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route
    ADD CONSTRAINT route_terminal_area_catalog_id_fkey FOREIGN KEY (terminal_area_catalog_id) REFERENCES public.terminal_area_catalog(id) ON DELETE RESTRICT;


--
-- Name: service_execution service_execution_complex_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_execution
    ADD CONSTRAINT service_execution_complex_service_id_fkey FOREIGN KEY (complex_service_id) REFERENCES public.complex_service_catalog(id) ON DELETE RESTRICT;


--
-- Name: service_execution service_execution_container_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_execution
    ADD CONSTRAINT service_execution_container_id_fkey FOREIGN KEY (container_id) REFERENCES public.container(id) ON DELETE RESTRICT;


--
-- Name: service_execution service_execution_receiving_order_id_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_execution
    ADD CONSTRAINT service_execution_receiving_order_id_service_order_id_fkey FOREIGN KEY (receiving_order_id, service_order_id) REFERENCES public.receiving_order(id, service_order_id) ON DELETE RESTRICT;


--
-- Name: service_execution service_execution_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_execution
    ADD CONSTRAINT service_execution_service_order_id_fkey FOREIGN KEY (service_order_id) REFERENCES public.service_order(id) ON DELETE RESTRICT;


--
-- Name: service_execution service_execution_shipping_order_id_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_execution
    ADD CONSTRAINT service_execution_shipping_order_id_service_order_id_fkey FOREIGN KEY (shipping_order_id, service_order_id) REFERENCES public.shipping_order(id, service_order_id) ON DELETE RESTRICT;


--
-- Name: service_execution service_execution_tariff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_execution
    ADD CONSTRAINT service_execution_tariff_id_fkey FOREIGN KEY (tariff_id) REFERENCES public.complex_service_tariff(id) ON DELETE RESTRICT;


--
-- Name: service_order service_order_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order
    ADD CONSTRAINT service_order_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.client(id) ON DELETE RESTRICT;


--
-- Name: service_order service_order_contract_id_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order
    ADD CONSTRAINT service_order_contract_id_client_id_fkey FOREIGN KEY (contract_id, client_id) REFERENCES public.contract(id, client_id) ON DELETE RESTRICT;


--
-- Name: shipping_order shipping_order_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order
    ADD CONSTRAINT shipping_order_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.client(id) ON DELETE RESTRICT;


--
-- Name: shipping_order shipping_order_consignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order
    ADD CONSTRAINT shipping_order_consignee_id_fkey FOREIGN KEY (consignee_id) REFERENCES public.client_related_entity(id);


--
-- Name: shipping_order_container shipping_order_container_container_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_container
    ADD CONSTRAINT shipping_order_container_container_id_fkey FOREIGN KEY (container_id) REFERENCES public.container(id) ON DELETE RESTRICT;


--
-- Name: shipping_order_container shipping_order_container_hazard_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_container
    ADD CONSTRAINT shipping_order_container_hazard_class_id_fkey FOREIGN KEY (danger_class_id) REFERENCES public.danger_class(id) ON DELETE RESTRICT;


--
-- Name: shipping_order_container_item shipping_order_container_item_etsng_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_container_item
    ADD CONSTRAINT shipping_order_container_item_etsng_code_id_fkey FOREIGN KEY (etsng_code_id) REFERENCES public.etsng_code(id) ON DELETE RESTRICT;


--
-- Name: shipping_order_container_item shipping_order_container_item_shipping_order_container_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_container_item
    ADD CONSTRAINT shipping_order_container_item_shipping_order_container_id_fkey FOREIGN KEY (shipping_order_container_id) REFERENCES public.shipping_order_container(id) ON DELETE CASCADE;


--
-- Name: shipping_order_container shipping_order_container_owner_container_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_container
    ADD CONSTRAINT shipping_order_container_owner_container_id_fkey FOREIGN KEY (owner_container_id) REFERENCES public.client_related_entity(id);


--
-- Name: shipping_order_container_qty shipping_order_container_qty_shipping_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_container_qty
    ADD CONSTRAINT shipping_order_container_qty_shipping_order_id_fkey FOREIGN KEY (shipping_order_id) REFERENCES public.shipping_order(id) ON DELETE CASCADE;


--
-- Name: shipping_order_container shipping_order_container_seal_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_container
    ADD CONSTRAINT shipping_order_container_seal_type_id_fkey FOREIGN KEY (seal_type_id) REFERENCES public.seal_type(id) ON DELETE RESTRICT;


--
-- Name: shipping_order_container shipping_order_container_shipping_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_container
    ADD CONSTRAINT shipping_order_container_shipping_order_id_fkey FOREIGN KEY (shipping_order_id) REFERENCES public.shipping_order(id) ON DELETE CASCADE;


--
-- Name: shipping_order shipping_order_contract_id_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order
    ADD CONSTRAINT shipping_order_contract_id_client_id_fkey FOREIGN KEY (contract_id, client_id) REFERENCES public.contract(id, client_id) ON DELETE RESTRICT;


--
-- Name: shipping_order_etsng_code shipping_order_etsng_code_etsng_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_etsng_code
    ADD CONSTRAINT shipping_order_etsng_code_etsng_code_id_fkey FOREIGN KEY (etsng_code_id) REFERENCES public.etsng_code(id) ON DELETE RESTRICT;


--
-- Name: shipping_order_etsng_code shipping_order_etsng_code_shipping_order_container_qty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_etsng_code
    ADD CONSTRAINT shipping_order_etsng_code_shipping_order_container_qty_id_fkey FOREIGN KEY (shipping_order_container_qty_id) REFERENCES public.shipping_order_container_qty(id) ON DELETE CASCADE;


--
-- Name: shipping_order_railway_carriage shipping_order_railway_carriage_new_railway_carriage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_railway_carriage
    ADD CONSTRAINT shipping_order_railway_carriage_new_railway_carriage_id_fkey FOREIGN KEY (railway_carriage_id) REFERENCES public.railway_carriage(id) ON DELETE RESTRICT;


--
-- Name: shipping_order_railway_carriage shipping_order_railway_carriage_new_shipping_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_railway_carriage
    ADD CONSTRAINT shipping_order_railway_carriage_new_shipping_order_id_fkey FOREIGN KEY (shipping_order_id) REFERENCES public.shipping_order(id) ON DELETE CASCADE;


--
-- Name: shipping_order_railway_carriage_qty shipping_order_railway_carriage_qty_shipping_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_railway_carriage_qty
    ADD CONSTRAINT shipping_order_railway_carriage_qty_shipping_order_id_fkey FOREIGN KEY (shipping_order_id) REFERENCES public.shipping_order(id) ON DELETE CASCADE;


--
-- Name: shipping_order_railway_carriage_qty shipping_order_railway_carriage_qty_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_railway_carriage_qty
    ADD CONSTRAINT shipping_order_railway_carriage_qty_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.railway_carriage_type(id) ON DELETE RESTRICT;


--
-- Name: shipping_order shipping_order_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order
    ADD CONSTRAINT shipping_order_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.route(id) ON DELETE RESTRICT;


--
-- Name: shipping_order shipping_order_service_order_id_client_id_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order
    ADD CONSTRAINT shipping_order_service_order_id_client_id_contract_id_fkey FOREIGN KEY (service_order_id, client_id, contract_id) REFERENCES public.service_order(id, client_id, contract_id) ON DELETE RESTRICT;


--
-- Name: shipping_order_source_container shipping_order_source_contain_shipping_order_id_service_or_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_source_container
    ADD CONSTRAINT shipping_order_source_contain_shipping_order_id_service_or_fkey FOREIGN KEY (shipping_order_id, service_order_id) REFERENCES public.shipping_order(id, service_order_id) ON DELETE CASCADE;


--
-- Name: shipping_order_source_container shipping_order_source_container_container_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_source_container
    ADD CONSTRAINT shipping_order_source_container_container_id_fkey FOREIGN KEY (container_id) REFERENCES public.container(id) ON DELETE RESTRICT;


--
-- Name: shipping_order shipping_order_source_receiving_order_id_service_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order
    ADD CONSTRAINT shipping_order_source_receiving_order_id_service_order_id_fkey FOREIGN KEY (source_receiving_order_id, service_order_id) REFERENCES public.receiving_order(id, service_order_id) ON DELETE RESTRICT;


--
-- Name: waybill_container waybill_container_container_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waybill_container
    ADD CONSTRAINT waybill_container_container_id_fkey FOREIGN KEY (container_id) REFERENCES public.container(id) ON DELETE RESTRICT;


--
-- Name: waybill_container waybill_container_waybill_railway_carriage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waybill_container
    ADD CONSTRAINT waybill_container_waybill_railway_carriage_id_fkey FOREIGN KEY (waybill_railway_carriage_id) REFERENCES public.waybill_railway_carriage(id) ON DELETE CASCADE;


--
-- Name: waybill waybill_departure_station_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waybill
    ADD CONSTRAINT waybill_departure_station_id_fkey FOREIGN KEY (departure_station_id) REFERENCES public.railway_station(id);


--
-- Name: waybill waybill_destination_station_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waybill
    ADD CONSTRAINT waybill_destination_station_id_fkey FOREIGN KEY (destination_station_id) REFERENCES public.railway_station(id);


--
-- Name: waybill waybill_payer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waybill
    ADD CONSTRAINT waybill_payer_id_fkey FOREIGN KEY (payer_id) REFERENCES public.payer(id);


--
-- Name: waybill_product waybill_product_etsng_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waybill_product
    ADD CONSTRAINT waybill_product_etsng_code_id_fkey FOREIGN KEY (etsng_code_id) REFERENCES public.etsng_code(id) ON DELETE RESTRICT;


--
-- Name: waybill_product waybill_product_waybill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waybill_product
    ADD CONSTRAINT waybill_product_waybill_id_fkey FOREIGN KEY (waybill_id) REFERENCES public.waybill(id) ON DELETE CASCADE;


--
-- Name: waybill_railway_carriage waybill_railway_carriage_railway_carriage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waybill_railway_carriage
    ADD CONSTRAINT waybill_railway_carriage_railway_carriage_id_fkey FOREIGN KEY (railway_carriage_id) REFERENCES public.railway_carriage(id) ON DELETE RESTRICT;


--
-- Name: waybill_railway_carriage waybill_railway_carriage_waybill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waybill_railway_carriage
    ADD CONSTRAINT waybill_railway_carriage_waybill_id_fkey FOREIGN KEY (waybill_id) REFERENCES public.waybill(id) ON DELETE CASCADE;


--
-- Name: waybill waybill_receiving_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waybill
    ADD CONSTRAINT waybill_receiving_order_id_fkey FOREIGN KEY (receiving_order_id) REFERENCES public.receiving_order(id) ON DELETE RESTRICT;


--
-- Name: waybill_zpu waybill_zpu_waybill_container_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waybill_zpu
    ADD CONSTRAINT waybill_zpu_waybill_container_id_fkey FOREIGN KEY (waybill_container_id) REFERENCES public.waybill_container(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--



