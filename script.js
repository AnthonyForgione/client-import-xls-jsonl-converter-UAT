document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('excel-file');
    const downloadLink = document.getElementById('download-link');
    const statusMessage = document.getElementById('status-message');

    if (uploadForm) {
        uploadForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            statusMessage.textContent = 'Processing file... Please wait.';
            statusMessage.style.color = 'blue';
            downloadLink.style.display = 'none';

            const file = fileInput.files[0];
            if (!file) {
                statusMessage.textContent = 'Please select an Excel file.';
                statusMessage.style.color = 'red';
                return;
            }

            try {
                const data = await readFile(file);
                const workbook = XLSX.read(data, { type: 'binary' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonSheet = XLSX.utils.sheet_to_json(worksheet);

                const transformedData = processExcelData(jsonSheet);

                if (transformedData.length === 0) {
                    statusMessage.textContent = 'No valid data found to transform. Please check your Excel file.';
                    statusMessage.style.color = 'orange';
                    return;
                }

                const jsonlContent = transformedData.map(record => JSON.stringify(record)).join('\n');
                const outputFilename = file.name.split('.').slice(0, -1).join('.') + '.jsonl';

                const blob = new Blob([jsonlContent], { type: 'application/jsonl' });
                const url = URL.createObjectURL(blob);

                downloadLink.href = url;
                downloadLink.download = outputFilename;
                downloadLink.textContent = `Download ${outputFilename}`;
                downloadLink.style.display = 'block';

                statusMessage.textContent = 'File successfully processed! Click the download link.';
                statusMessage.style.color = 'green';

            } catch (error) {
                console.error('Error processing file:', error);
                statusMessage.textContent = `Error processing file: ${error.message}`;
                statusMessage.style.color = 'red';
            }
        });
    }

    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsBinaryString(file);
        });
    }

    function is_empty(value) {
        if (value === null || typeof value === 'undefined') {
            return true;
        }
        if (typeof value === 'number' && isNaN(value)) {
            return true;
        }
        if (typeof value === 'string') {
            return value.trim() === '';
        }
        if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
            return Object.keys(value).length === 0;
        }
        return false;
    }

    function _to_string_id(value) {
        if (typeof value === 'number' && !isNaN(value) && value % 1 === 0) {
            return String(parseInt(value));
        }
        return String(value);
    }

    function _to_string_list(value) {
        if (is_empty(value)) {
            return null;
        }
        if (typeof value === 'string') {
            return value.split(',').map(item => item.trim()).filter(item => item !== '');
        }
        return [String(value)];
    }

    function _to_unix_timestamp_ms(value) {
        if (is_empty(value)) {
            return null;
        }
        try {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
                return null;
            }
            return date.getTime();
        } catch (e) {
            return null;
        }
    }

    function processExcelData(jsonData) {
        const transformedData = [];
        for (const row of jsonData) {
            const clientData = transform_row_to_client_json(row);
            const hasEntityType = 'entityType' in clientData && !is_empty(clientData['entityType']);
            const hasNameInfo = ['name', 'forename', 'surname', 'companyName'].some(key => key in clientData && !is_empty(clientData[key]));

            if (hasEntityType || hasNameInfo) {
                transformedData.push(clientData);
            }
        }
        return transformedData;
    }

    function transform_row_to_client_json(row) {
        const clientData = {};
        clientData['objectType'] = 'client';

        function add_field_if_not_empty(key, value) {
            if (!is_empty(value)) {
                clientData[key] = value;
            }
        }

        add_field_if_not_empty('clientId', row['clientId']);
        add_field_if_not_empty('entityType', row['entityType']);
        add_field_if_not_empty('status', row['status']);

        const entityType = row['entityType'];
        let entityTypeUpper;
        if (!is_empty(entityType)) {
            entityTypeUpper = String(entityType).toUpperCase();
        } else {
            entityTypeUpper = null;
        }

        if (entityTypeUpper === 'ORGANISATION') {
            add_field_if_not_empty('companyName', row['name']);
        } else if (entityTypeUpper === 'PERSON') {
            add_field_if_not_empty('name', row['name']);
            add_field_if_not_empty('forename', row['forename']);
            add_field_if_not_empty('middlename', row['middlename']);
            add_field_if_not_empty('surname', row['surname']);
        } else {
            add_field_if_not_empty('name', row['name']);
            add_field_if_not_empty('forename', row['forename']);
            add_field_if_not_empty('middlename', row['middlename']);
            add_field_if_not_empty('surname', row['surname']);
        }

        add_field_if_not_empty('titles', row['titles']);
        add_field_if_not_empty('suffixes', row['suffixes']);

        if (entityTypeUpper === 'PERSON') {
            let genderValue = row['gender'];
            if (typeof genderValue === 'string' && !is_empty(genderValue)) {
                genderValue = genderValue.toUpperCase();
            }
            add_field_if_not_empty('gender', genderValue);

            const dateOfBirthValue = row['dateOfBirth'];
            add_field_if_not_empty('dateOfBirth', !is_empty(dateOfBirthValue) ? String(dateOfBirthValue) : dateOfBirthValue);

            add_field_if_not_empty('birthPlaceCountryCode', row['birthPlaceCountryCode']);

            const deceasedOnValue = row['deceasedOn'];
            add_field_if_not_empty('deceasedOn', !is_empty(deceasedOnValue) ? String(deceasedOnValue) : deceasedOnValue);

            add_field_if_not_empty('occupation', row['occupation']);
            add_field_if_not_empty('domicileCodes', _to_string_list(row['domicileCodes']));
            add_field_if_not_empty('nationalityCodes', _to_string_list(row['nationalityCodes']));
        }

        if (entityTypeUpper === 'ORGANISATION') {
            add_field_if_not_empty('incorporationCountryCode', row['incorporationCountryCode']);

            const dateOfIncorporationValue = row['dateOfIncorporation'];
            add_field_if_not_empty('dateOfIncorporation', !is_empty(dateOfIncorporationValue) ? String(dateOfIncorporationValue) : dateOfIncorporationValue);
        }

        const assessmentRequiredRawValue = row['assessmentRequired'];
        let assessmentRequiredBoolean = false;
        if (!is_empty(assessmentRequiredRawValue)) {
            assessmentRequiredBoolean = String(assessmentRequiredRawValue).toLowerCase() === 'true' || String(assessmentRequiredRawValue) === '1' || String(assessmentRequiredRawValue) === '1.0';
        }

        if (assessmentRequiredBoolean) {
            add_field_if_not_empty('lastReviewed', _to_unix_timestamp_ms(row['lastReviewed']));
        }

        add_field_if_not_empty('periodicReviewStartDate', _to_unix_timestamp_ms(row['periodicReviewStartDate']));

        const periodicReviewPeriodValue = row['periodicReviewPeriod'];
        add_field_if_not_empty('periodicReviewPeriod', !is_empty(periodicReviewPeriodValue) ? String(periodicReviewPeriodValue) : periodicReviewPeriodValue);

        const addressesList = [];
        const currentAddress = {};

        const addressLine1 = row['Address line1'];
        if (!is_empty(addressLine1)) {
            currentAddress['line1'] = String(addressLine1);
        }
        const addressLine2 = row['Address line2'];
        if (!is_empty(addressLine2)) {
            currentAddress['line2'] = String(addressLine2);
        }
        const addressLine3 = row['Address line3'];
        if (!is_empty(addressLine3)) {
            currentAddress['line3'] = String(addressLine3);
        }
        const addressLine4 = row['Address line4'];
        if (!is_empty(addressLine4)) {
            currentAddress['line4'] = String(addressLine4);
        }
        const poBox = row['poBox'];
        if (!is_empty(poBox)) {
            currentAddress['poBox'] = String(poBox);
        }
        const city = row['city'];
        if (!is_empty(city)) {
            currentAddress['city'] = String(city);
        }
        const state = row['state'];
        if (!is_empty(state)) {
            currentAddress['state'] = String(state);
        }
        const province = row['province'];
        if (!is_empty(province)) {
            currentAddress['province'] = String(province);
        }
        const postcode = row['postcode'];
        if (!is_empty(postcode)) {
            currentAddress['postcode'] = String(postcode);
        }
        const country = row['country'];
        if (!is_empty(country)) {
            currentAddress['country'] = String(country);
        }
        const countryCode = row['countryCode'];
        if (!is_empty(countryCode)) {
            currentAddress['countryCode'] = String(countryCode).toUpperCase().substring(0, 2);
        }

        if (Object.keys(currentAddress).length > 0) {
            addressesList.push(currentAddress);
        }

        add_field_if_not_empty('addresses', addressesList);

        add_field_if_not_empty('segment', !is_empty(row['segment']) ? String(row['segment']) : row['segment']);

        const identityNumbersList = [];

        if (entityTypeUpper === 'ORGANISATION') {
            const dunsNumber = row['Duns Number'];
            if (!is_empty(dunsNumber)) {
                identityNumbersList.push({ "type": "duns", "value": _to_string_id(dunsNumber) });
            }
            const nationalTaxNo = row['National Tax No.'];
            if (!is_empty(nationalTaxNo)) {
                identityNumbersList.push({ "type": "tax_no", "value": _to_string_id(nationalTaxNo) });
            }
            const legalEntityIdentifier = row['Legal Entity Identifier (LEI)'];
            if (!is_empty(legalEntityIdentifier)) {
                identityNumbersList.push({ "type": "lei", "value": _to_string_id(legalEntityIdentifier) });
            }
        } else if (entityTypeUpper === 'PERSON') {
            const nationalId = row['National ID'];
            if (!is_empty(nationalId)) {
                identityNumbersList.push({ "type": "national_id", "value": _to_string_id(nationalId) });
            }
            const drivingLicenceNo = row['Driving Licence No.'];
            if (!is_empty(drivingLicenceNo)) {
                identityNumbersList.push({ "type": "driving_licence", "value": _to_string_id(drivingLicenceNo) });
            }
            const socialSecurityNumber = row['Social Security Number'];
            if (!is_empty(socialSecurityNumber)) {
                identityNumbersList.push({ "type": "ssn", "value": _to_string_id(socialSecurityNumber) });
            }
            const passportNumber = row['Passport No.'];
            if (!is_empty(passportNumber)) {
                identityNumbersList.push({ "type": "passport_no", "value": _to_string_id(passportNumber) });
            }
        }

        if (identityNumbersList.length > 0) {
            clientData['identityNumbers'] = identityNumbersList;
        }

        const aliasesList = [];
        const aliasColumns = ['aliases1', 'aliases2', 'aliases3', 'aliases4'];
        const aliasNameTypes = {
            'aliases1': 'AKA1',
            'aliases2': 'AKA2',
            'aliases3': 'AKA3',
            'aliases4': 'AKA4',
        };

        for (const colName of aliasColumns) {
            const aliasValue = row[colName];
            if (!is_empty(aliasValue)) {
                const nameType = aliasNameTypes[colName] || colName.toUpperCase();

                if (entityTypeUpper === 'PERSON') {
                    aliasesList.push({ "name": String(aliasValue), "nameType": nameType });
                } else {
                    aliasesList.push({ "companyName": String(aliasValue), "nameType": nameType });
                }
            }
        }

        if (aliasesList.length > 0) {
            clientData['aliases'] = aliasesList;
        }

        const securityEnabled = row['Security Enabled'];
        if (securityEnabled !== null && securityEnabled !== undefined && (String(securityEnabled).toLowerCase() === 'true' || String(securityEnabled) === 't' || String(securityEnabled) === '1')) {
            const securityTags = {};

            const tag1 = row['Tag 1'];
            if (!is_empty(tag1)) {
                securityTags['orTags1'] = tag1;
            }
            const tag2 = row['Tag 2'];
            if (!is_empty(tag2)) {
                securityTags['orTags2'] = tag2;
            }
            const tag3 = row['Tag 3'];
            if (!is_empty(tag3)) {
                securityTags['orTags3'] = tag3;
            }

            clientData['security'] = securityTags;
        }

        if (!is_empty(assessmentRequiredRawValue)) {
            add_field_if_not_empty('assessmentRequired', assessmentRequiredBoolean);
        }

        return clientData;
    }
});
