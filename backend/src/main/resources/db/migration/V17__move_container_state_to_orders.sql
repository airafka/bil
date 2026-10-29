update complex_service_stage
   set container_state = 'ANY'
 where container_state <> 'ANY';
