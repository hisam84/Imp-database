export function buildInstitutionData(body: any) {
  const dateOrNull = (v: any) => (v ? new Date(v) : null);
  const strOrNull = (v: any) => (v === undefined || v === null || v === "" ? null : String(v).trim());

  const inChargeTeacher2 = strOrNull(
    body.inChargeTeacher2 ??
    body.customFields?.inChargeTeacher2 ??
    body.customFields?.cf_in_charge_2 ??
    body.customFields?.in_charge_2 ??
    body.customFields?.["IN CHARGE 2"]
  );

  const inChargeTeacher2Contact = strOrNull(
    body.inChargeTeacher2Contact ??
    body.customFields?.inChargeTeacher2Contact ??
    body.customFields?.cf_in_charge_2_contact ??
    body.customFields?.in_charge_2_contact ??
    body.customFields?.["IN CHARGE 2 CONTACT"]
  );

  const googleMapsUrl = strOrNull(
    body.googleMapsUrl ??
    body.customFields?.googleMapsUrl
  );

  // Clean custom fields: keep non-empty values, exclude legacy migrated keys
  const cleanedCustomFields: Record<string, any> = {};
  if (body.customFields && typeof body.customFields === "object") {
    for (const [k, val] of Object.entries(body.customFields)) {
      if (
        k === "isDeactivated" ||
        k === "callUpdates" ||
        k === "communicationLogs" ||
        k === "googleMapsUrl"
      ) {
        cleanedCustomFields[k] = val;
        continue;
      }
      if (
        k === "inChargeTeacher2" ||
        k === "inChargeTeacher2Contact" ||
        k === "cf_in_charge_2" ||
        k === "in_charge_2" ||
        k === "cf_in_charge_2_contact" ||
        k === "in_charge_2_contact" ||
        k === "IN CHARGE 2" ||
        k === "IN CHARGE 2 CONTACT"
      ) {
        continue;
      }
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        cleanedCustomFields[k] = String(val).trim();
      }
    }
  }

  // Backup into customFields for robust fallback
  if (googleMapsUrl) {
    cleanedCustomFields.googleMapsUrl = googleMapsUrl;
  }
  if (inChargeTeacher2) {
    cleanedCustomFields.inChargeTeacher2 = inChargeTeacher2;
  }
  if (inChargeTeacher2Contact) {
    cleanedCustomFields.inChargeTeacher2Contact = inChargeTeacher2Contact;
  }

  return {
    instituteName: String(body.instituteName).trim(),
    instituteNameBangla: strOrNull(body.instituteNameBangla),
    domain: strOrNull(body.domain),
    category: strOrNull(body.category) ?? "Website",
    instituteType: strOrNull(body.instituteType) ?? "School",
    issueDate: dateOrNull(body.issueDate),
    expireDate: dateOrNull(body.expireDate),
    actualExpireDate: dateOrNull(body.actualExpireDate),
    student: strOrNull(body.student),
    condition: strOrNull(body.condition),
    btclUsername: strOrNull(body.btclUsername),
    btclPassword: strOrNull(body.btclPassword),
    btclMobileNo: strOrNull(body.btclMobileNo),
    btclEmail: strOrNull(body.btclEmail),
    btclEmailPassword: strOrNull(body.btclEmailPassword),
    instituteHead: strOrNull(body.instituteHead),
    contact1: strOrNull(body.contact1),
    contact2: strOrNull(body.contact2),
    inChargeTeacher: strOrNull(body.inChargeTeacher),
    designation: strOrNull(body.designation),
    inChargeTeacherContact: strOrNull(body.inChargeTeacherContact),
    subDistrict: strOrNull(body.subDistrict),
    district: strOrNull(body.district),
    address: strOrNull(body.address),
    customFields: cleanedCustomFields,
  };
}
