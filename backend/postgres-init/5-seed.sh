#!/bin/bash

# CSV 파일들이 위치한 디렉토리
CSV_DIR="/docker-entrypoint-initdb.d/data"
# 데이터베이스 접속 정보
DB_NAME="ohdsi"
DB_SCHEMA="ohdsi_test"
DB_USER="ohdsi"

success_tables=()
failed_tables=()

# ohdsi_test 안에 모든 테이블에 있는 데이터 삭제
tables=(
    'COHORT'
    'MEASUREMENT'
    'OBSERVATION'
    'PAYER_PLAN_PERIOD'
    'DEVICE_EXPOSURE'
    'PROCEDURE_OCCURRENCE'
    'DRUG_EXPOSURE'
    'CONDITION_OCCURRENCE'
    'SPECIMEN'
    'DRUG_STRENGTH'
    'COST'
    'SOURCE_TO_CONCEPT_MAP'
    'NOTE_NLP'
    'DEATH'
    'METADATA'
    'FACT_RELATIONSHIP'
    'DOSE_ERA'
    'CONCEPT_RELATIONSHIP'
    'OBSERVATION_PERIOD'
    'EPISODE_EVENT'
    'DRUG_ERA'
    'CONDITION_ERA'
    'CONCEPT_SYNONYM'
    'CONCEPT_ANCESTOR'
    'COHORT_DEFINITION'
    'CDM_SOURCE'
    'NOTE'
    'EPISODE'
    'RELATIONSHIP'
    'VISIT_DETAIL'
    'VISIT_OCCURRENCE'
    'PERSON'
    'PROVIDER'
    'CARE_SITE'
    'LOCATION'
    'DOMAIN'
    'VOCABULARY'
    'CONCEPT_CLASS'
    'CONCEPT'
)

for table in "${tables[@]}"; do
    psql -d $DB_NAME -U $DB_USER -c "TRUNCATE TABLE $DB_SCHEMA.$table CASCADE;"
done


# 데이터 삽입을 위한 함수
insert_data() {
    local csv_file=$1
    local table=$2

    echo "Processing file: $(basename "$csv_file")"

    psql -d $DB_NAME -U $DB_USER -c "\copy $DB_SCHEMA.$table FROM '$csv_file' DELIMITER E'\t' NULL as ''"

    if [ $? -eq 0 ]; then
        success_tables+=($table)
    else
        failed_tables+=($table)
    fi
}

tables=(
    CONCEPT
    CONCEPT_CLASS
    VOCABULARY
    DOMAIN
    LOCATION
    CARE_SITE
    PROVIDER
    PERSON
    VISIT_OCCURRENCE
    VISIT_DETAIL
    RELATIONSHIP
    EPISODE
    NOTE
    CDM_SOURCE
    COHORT_DEFINITION
    CONCEPT_ANCESTOR
    CONCEPT_SYNONYM
    CONDITION_ERA
    DRUG_ERA
    EPISODE_EVENT
    OBSERVATION_PERIOD
    CONCEPT_RELATIONSHIP
    DOSE_ERA
    FACT_RELATIONSHIP
    METADATA
    DEATH
    NOTE_NLP
    SOURCE_TO_CONCEPT_MAP
    COST
    DRUG_STRENGTH
    SPECIMEN
    CONDITION_OCCURRENCE
    DRUG_EXPOSURE
    PROCEDURE_OCCURRENCE
    DEVICE_EXPOSURE
    PAYER_PLAN_PERIOD
    OBSERVATION
    MEASUREMENT
    COHORT
)

csv_files=$(ls "$CSV_DIR"/*.csv 2> /dev/null)
if [ $? -ne 0 ]; then
    echo "No CSV files found in $CSV_DIR"
    exit 1
fi

for table in "${tables[@]}"; do
    csv_file="$CSV_DIR/$table.csv"
    if [ ! -f "$csv_file" ]; then
        echo "File $csv_file not found."
        continue
    fi

    # 데이터 삽입 함수 호출
    insert_data "$csv_file" "$table"
done


echo "Success tables: ${success_tables[@]}"
echo "Failed tables: ${failed_tables[@]}"