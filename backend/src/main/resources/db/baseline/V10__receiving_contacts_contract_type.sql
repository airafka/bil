ALTER TABLE contract ADD COLUMN contract_type varchar(255) NOT NULL DEFAULT 'Транспортно-экспедиционное обслуживание «ТЭО»';
ALTER TABLE receiving_order
    ADD COLUMN authorized_representative varchar(255),
    ADD COLUMN phone varchar(50),
    ADD COLUMN email varchar(254),
    ADD COLUMN comment varchar(4000);
