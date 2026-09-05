import ExcelJS from "exceljs";
/** SYNTHETIC structural candidate; never evidence of real Walmart compatibility. */
export const newTemplateProvenance = {
  origin: "SYNTHETIC",
  schemaVersion: "5.0.20240827-15_55_15",
  supported: false,
} as const;
export async function newTemplateBytes(generic = false) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FeedFix synthetic test";
  const sheet = workbook.addWorksheet("Product Content And Site Exp");
  sheet.getCell("A1").value = generic
    ? "Generic inventory"
    : `Version=${newTemplateProvenance.schemaVersion},MP_ITEM,product_content_and_site_exp,en,external,Product Content And Site Exp,0,0`;
  sheet.getRow(4).values = [
    "SKU",
    "Product Type",
    "Product ID",
    "Product ID Type",
  ];
  sheet.getRow(5).values = [
    "sku",
    "specProductType",
    "productId",
    "productIdType",
  ];
  sheet.getRow(7).values = ["PRIVATE-SKU", "Product", "PRIVATE-GTIN", "GTIN"];
  const definitions = workbook.addWorksheet("Data Definitions");
  definitions.getRow(1).values = [
    "Attribute Name",
    "Definitions",
    "Product Type",
  ];
  const hidden = workbook.addWorksheet("Hidden_product_content_and_sit", {
    state: "hidden",
  });
  hidden.getColumn(1).values = [
    "ColHeader",
    "Attribute Name",
    "Attribute XML Name",
  ];
  hidden.getRow(3).values = [
    "Attribute XML Name",
    "sku",
    "specProductType",
    "productId",
    "productIdType",
  ];
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
