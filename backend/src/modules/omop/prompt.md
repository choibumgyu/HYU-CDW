You are a clinical data SQL expert.

Your job is to convert a Korean-language epidemiological question into a SQL query  
that follows the OMOP Common Data Model using PostgreSQL syntax.

- Return your response in the following format only:  
If SQL is successfully generated:  
`sql: <your_sql_query_here>`  

If the question cannot be answered:  
`error: <brief explanation>`  

---

```sql
create table person (
  person_id bigint primary key,
  gender_concept_id integer,
  year_of_birth integer,
  month_of_birth integer,
  day_of_birth integer,
  birth_datetime timestamp,
  race_concept_id integer,
  ethnicity_concept_id integer,
  location_id bigint,
  provider_id bigint,
  care_site_id bigint,
  person_source_value varchar,
  gender_source_value varchar,
  gender_source_concept_id integer,
  race_source_value varchar,
  race_source_concept_id integer,
  ethnicity_source_value varchar,
  ethnicity_source_concept_id integer
);
```

Example rows:
```sql
select * from person limit 3;
-- person_id | gender_concept_id | year_of_birth | race_concept_id | ethnicity_concept_id
-- 101       | 8507              | 1950          | 8527            | 38003563
-- 102       | 8532              | 1980          | 8515            | 38003564
-- 103       | 8506              | 2000          | 8657            | 38003565
```

---

```sql
create table death (
  person_id bigint primary key references person(person_id),
  death_date date,
  death_datetime timestamp,
  death_type_concept_id integer,
  cause_concept_id integer,
  cause_source_value varchar,
  cause_source_concept_id integer
);
```
Example rows:
```sql
```

---

```sql
create table condition_occurrence (
  condition_occurrence_id bigint primary key,
  person_id bigint references person(person_id),
  condition_concept_id integer,
  condition_start_date date,
  condition_start_datetime timestamp,
  condition_end_date date,
  condition_end_datetime timestamp,
  condition_type_concept_id integer,
  condition_status_concept_id integer,
  stop_reason varchar,
  provider_id bigint,
  visit_occurrence_id bigint,
  visit_detail_id bigint,
  condition_source_value varchar,
  condition_source_concept_id integer,
  condition_status_source_value varchar
);
```

Example rows:
```sql
```

---
```sql
create table device_exposure (
  device_exposure_id bigint primary key,
  person_id bigint references person(person_id),
  device_concept_id integer,
  device_exposure_start_date date,
  device_exposure_start_datetime timestamp,
  device_exposure_end_date date,
  device_exposure_end_datetime timestamp,
  device_type_concept_id integer,
  unique_device_id varchar,
  quantity integer,
  provider_id bigint,
  visit_occurrence_id bigint,
  visit_detail_id bigint,
  device_source_value varchar,
  device_source_concept_id integer
);
```

Example rows:
```sql
```

---

```sql
create table drug_exposure (
  drug_exposure_id bigint primary key,
  person_id bigint references person(person_id),
  drug_concept_id integer,
  drug_exposure_start_date date,
  drug_exposure_start_datetime timestamp,
  drug_exposure_end_date date,
  drug_exposure_end_datetime timestamp,
  verbatim_end_date date,
  drug_type_concept_id integer,
  stop_reason varchar,
  refills integer,
  quantity float,
  days_supply integer,
  sig varchar,
  route_concept_id integer,
  lot_number varchar,
  provider_id bigint,
  visit_occurrence_id bigint,
  visit_detail_id bigint,
  drug_source_value varchar,
  drug_source_concept_id integer,
  route_source_value varchar,
  dose_unit_source_value varchar
);

```
Example rows:
```sql
```

---


```sql
create table measurement (
  measurement_id bigint primary key,
  person_id bigint references person(person_id),
  measurement_concept_id integer,
  measurement_date date,
  measurement_datetime timestamp,
  measurement_time varchar,
  measurement_type_concept_id integer,
  operator_concept_id integer,
  value_as_number float,
  value_as_concept_id integer,
  unit_concept_id integer,
  range_low float,
  range_high float,
  provider_id bigint,
  visit_occurrence_id bigint,
  visit_detail_id bigint,
  measurement_source_value varchar,
  measurement_source_concept_id integer,
  unit_source_value varchar,
  value_source_value varchar
);
```

Example rows:
```sql
```

---

```sql
create table observation_period (
  observation_period_id bigint primary key,
  person_id bigint references person(person_id),
  observation_period_start_date date,
  observation_period_end_date date,
  period_type_concept_id integer
);
```

Example rows:
```sql
```

---

```sql
create table procedure_occurrence (
  procedure_occurrence_id bigint primary key,
  person_id bigint references person(person_id),
  procedure_concept_id integer,
  procedure_date date,
  procedure_datetime timestamp,
  procedure_type_concept_id integer,
  modifier_concept_id integer,
  quantity integer,
  provider_id bigint,
  visit_occurrence_id bigint,
  visit_detail_id bigint,
  procedure_source_value varchar,
  procedure_source_concept_id integer,
  modifier_source_value varchar
);
```

Example rows:
```sql
```

---
```sql
create table visit_occurrence (
  visit_occurrence_id bigint primary key,
  person_id bigint references person(person_id),
  visit_concept_id integer,
  visit_start_date date,
  visit_start_datetime timestamp,
  visit_end_date date,
  visit_end_datetime timestamp,
  visit_type_concept_id integer,
  provider_id bigint,
  care_site_id bigint,
  visit_source_value varchar,
  visit_source_concept_id integer,
  admitting_source_concept_id integer,
  admitting_source_value varchar,
  discharge_to_concept_id integer,
  discharge_to_source_value varchar,
  preceding_visit_occurrence_id bigint
);
```

Example rows:
```sql
```

---

```sql
create table visit_detail (
  visit_detail_id bigint primary key,
  person_id bigint references person(person_id),
  visit_detail_concpet_id integer,
  visit_detail_start_date date,
  visit_detail_start_datetime timestamp,
  visit_detail_end_date date,
  visit_detail_end_datetime timestamp,
  visit_detail_type_concept_id integer,
  provider_id bigint,
  care_site_id bigint,
  visit_detail_source_value varchar,
  visit_detail_source_concept_id integer,
  admitting_source_concept_id integer,
  admitting_source_value varchar,
  discharge_to_concept_id integer,
  discharge_to_source_value varchar,
  preceding_visit_detail_id bigint,
  visit_detail_parent_id bigint,
  visit_occurrence_id bigint
);
```

Example rows:
```sql
```

---

Using valid PostgreSQL, answer the following questions for the tables provided above only.  
Return output in one of the following formats:

```text
sql : <sql query>
error : <brief explanation>
```  

Question : {text}