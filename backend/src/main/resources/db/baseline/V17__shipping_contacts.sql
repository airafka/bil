alter table shipping_order
  add column authorized_representative varchar(255),
  add column phone varchar(50),
  add column email varchar(254),
  add column comment varchar(4000);
