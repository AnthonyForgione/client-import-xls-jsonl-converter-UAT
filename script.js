// Main row transformer (mirrors the Python transform_row_to_client_json)
  function transformRowToClientJson(rowRaw) {
    const row = normalizeRowKeys(rowRaw);
    const clientData = {};
    clientData.objectType = 'client';

    function addFieldIfNotEmpty(key, value) {
      if (!isEmpty(value)) clientData[key] = value;
    }

    function maybeString(v) {
      if (v === null || v === undefined) return v;
      return String(v);
    }

    // read primary fields
    addFieldIfNotEmpty('clientId', row['clientId']);
    addFieldIfNotEmpty('entityType', row['entityType']);
    addFieldIfNotEmpty('status', row['status']);

    let entityTypeUpper = null;
    if (!isEmpty(row['entityType'])) {
      entityTypeUpper = String(row['entityType']).toUpperCase();
    }

    // 2. Name fields
    if (entityTypeUpper === 'ORGANISATION' || entityTypeUpper === 'ORGANIZATION') {
      addFieldIfNotEmpty('companyName', row['name']);
    } else if (entityTypeUpper === 'PERSON') {
      addFieldIfNotEmpty('name', row['name']);
      addFieldIfNotEmpty('forename', row['forename']);
      addFieldIfNotEmpty('middlename', row['middlename']);
      addFieldIfNotEmpty('surname', row['surname']);
    } else {
      // fallback
      addFieldIfNotEmpty('name', row['name']);
      addFieldIfNotEmpty('forename', row['forename']);
      addFieldIfNotEmpty('middlename', row['middlename']);
      addFieldIfNotEmpty('surname', row['surname']);
    }

    // Common fields
    addFieldIfNotEmpty('titles', _to_string_list(row['titles'])); // CORRECTED
    addFieldIfNotEmpty('suffixes', _to_string_list(row['suffixes'])); // CORRECTED

    // Person-specific
    if (entityTypeUpper === 'PERSON') {
      let genderValue = row['gender'];
      if (typeof genderValue === 'string' && !isEmpty(genderValue)) genderValue = genderValue.toUpperCase();
      addFieldIfNotEmpty('gender', genderValue);

      const dob = row['dateOfBirth'];
      addFieldIfNotEmpty('dateOfBirth', isEmpty(dob) ? dob : String(dob));

      addFieldIfNotEmpty('birthPlaceCountryCode', row['birthPlaceCountryCode']);

      const deceasedOn = row['deceasedOn'];
      addFieldIfNotEmpty('deceasedOn', isEmpty(deceasedOn) ? deceasedOn : String(deceasedOn));

      addFieldIfNotEmpty('occupation', row['occupation']);
      addFieldIfNotEmpty('domicileCodes', _to_string_list(row['domicileCodes']));
      addFieldIfNotEmpty('nationalityCodes', _to_string_list(row['nationalityCodes']));
    }

    // Organisation-specific
    if (entityTypeUpper === 'ORGANISATION' || entityTypeUpper === 'ORGANIZATION') {
      addFieldIfNotEmpty('incorporationCountryCode', row['incorporationCountryCode']);
      const doi = row['dateOfIncorporation'];
      addFieldIfNotEmpty('dateOfIncorporation', isEmpty(doi) ? doi : String(doi));
    }

    // assessmentRequired boolean parsing
    const assessmentRequiredRawValue = row['assessmentRequired'];
    let assessmentRequiredBoolean = false;
    if (!isEmpty(assessmentRequiredRawValue)) {
      const rawStr = String(assessmentRequiredRawValue).toLowerCase();
      assessmentRequiredBoolean = ['true', '1', '1.0', 't', 'yes', 'y'].includes(rawStr);
    }

    // lastReviewed (only if assessmentRequired true) -> unix ms
    if (assessmentRequiredBoolean) {
      addFieldIfNotEmpty('lastReviewed', _to_unix_timestamp_ms(row['lastReviewed']));
    }

    addFieldIfNotEmpty('periodicReviewStartDate', _to_unix_timestamp_ms(row['periodicReviewStartDate']));

    const periodic_review_period_value = row['periodicReviewPeriod'];
    addFieldIfNotEmpty('periodicReviewPeriod', isEmpty(periodic_review_period_value) ? periodic_review_period_value : String(periodic_review_period_value));

    // Addresses
    const currentAddress = {};
    if (!isEmpty(row['Address line1'])) currentAddress.line1 = String(row['Address line1']);
    if (!isEmpty(row['Address line2'])) currentAddress.line2 = String(row['Address line2']);
    if (!isEmpty(row['Address line3'])) currentAddress.line3 = String(row['Address line3']);
    if (!isEmpty(row['Address line4'])) currentAddress.line4 = String(row['Address line4']);
    if (!isEmpty(row['poBox'])) currentAddress.poBox = String(row['poBox']);
    if (!isEmpty(row['city'])) currentAddress.city = String(row['city']);
    if (!isEmpty(row['state'])) currentAddress.state = String(row['state']);
    if (!isEmpty(row['province'])) currentAddress.province = String(row['province']);
    if (!isEmpty(row['postcode'])) currentAddress.postcode = String(row['postcode']);
    if (!isEmpty(row['country'])) currentAddress.country = String(row['country']);
    if (!isEmpty(row['countryCode'])) currentAddress.countryCode = String(row['countryCode']).toUpperCase().substring(0,2);

    if (Object.keys(currentAddress).length > 0) addFieldIfNotEmpty('addresses', [currentAddress]);

    addFieldIfNotEmpty('segment', isEmpty(row['segment']) ? row['segment'] : String(row['segment']));

    // identityNumbers
    const identityNumbersList = [];
    if (entityTypeUpper === 'ORGANISATION' || entityTypeUpper === 'ORGANIZATION') {
      if (!isEmpty(row['Duns Number'])) identityNumbersList.push({type:'duns', value: _to_string_id(row['Duns Number'])});
      if (!isEmpty(row['National Tax No.'])) identityNumbersList.push({type:'tax_no', value: _to_string_id(row['National Tax No.'])});
      if (!isEmpty(row['Legal Entity Identifier (LEI)'])) identityNumbersList.push({type:'lei', value: _to_string_id(row['Legal Entity Identifier (LEI)'])});
    } else if (entityTypeUpper === 'PERSON') {
      if (!isEmpty(row['National ID'])) identityNumbersList.push({type:'national_id', value: _to_string_id(row['National ID'])});
      if (!isEmpty(row['Driving Licence No.'])) identityNumbersList.push({type:'driving_licence', value: _to_string_id(row['Driving Licence No.'])});
      if (!isEmpty(row['Social Security No.'])) identityNumbersList.push({type:'ssn', value: _to_string_id(row['Social Security No.'])});
      if (!isEmpty(row['Passport No.'])) identityNumbersList.push({type:'passport_no', value: _to_string_id(row['Passport No.'])});
    }
    if (identityNumbersList.length > 0) clientData.identityNumbers = identityNumbersList;

    // aliases (aliases1..4)
    const aliasColumns = ['aliases1','aliases2','aliases3','aliases4'];
    const aliasNameTypes = {
      'aliases1':'AKA1','aliases2':'AKA2','aliases3':'AKA3','aliases4':'AKA4'
    };
    const aliasesList = [];
    for (const col of aliasColumns) {
      const val = row[col];
      if (!isEmpty(val)) {
        const nameType = aliasNameTypes[col] || col.toUpperCase();
        if (entityTypeUpper === 'PERSON') {
          aliasesList.push({name:String(val), nameType});
        } else {
          aliasesList.push({companyName:String(val), nameType});
        }
      }
    }
    if (aliasesList.length > 0) clientData.aliases = aliasesList;

    // security object
    const securityEnabled = row['Security Enabled'];
    if (!isEmpty(securityEnabled) && ['true','t','1','yes','y'].includes(String(securityEnabled).toLowerCase())) {
      const securityTags = {};
      if (!isEmpty(row['Tag 1'])) securityTags.orTags1 = row['Tag 1'];
      if (!isEmpty(row['Tag 2'])) securityTags.orTags2 = row['Tag 2'];
      if (!isEmpty(row['Tag 3'])) securityTags.orTags3 = row['Tag 3'];
      clientData.security = securityTags;
    }

    if (!isEmpty(assessmentRequiredRawValue)) {
      addFieldIfNotEmpty('assessmentRequired', assessmentRequiredBoolean);
    }

    return clientData;
  }
