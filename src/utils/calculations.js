import { safeNumber } from "./formatters";
import { GST_PERCENT } from "../data/constants";

export function calculateQuote(form) {
  const area = safeNumber(form.containerLength) * safeNumber(form.containerWidth);

  const steelCost = area * 190;
  const sheetMetalCost = area * 231;
  const flooringCost = area * 90;
  const electricalCost = area * 100;
  const paintingCost = area * 60;
  const doorCost = safeNumber(form.doors) * 6000;
  const windowCost = safeNumber(form.windows) * 3500;
  const partitionCost = safeNumber(form.partitions) * 10000;
  const laborCost = area * 100;
  const transportCost = safeNumber(form.distanceToSite) * 120;
  const toiletCost = form.toiletUnit ? 20000 : 0;
  const insulationCost = form.insulation ? area * 155 : 0;
  const glassDoorCost = form.glassDoor ? 12000 : 0;
  const falseCeilingCost = form.falseCeiling ? area * 110 : 0;

  const bedCost = safeNumber(form.bed) * 3500;
  const bunkBedCost = safeNumber(form.bunkBed) * 9000;
  const workstationCost = safeNumber(form.workstation) * 4000;
  const managerialTableCost = form.managerialTable ? 7000 : 0;
  const conferenceTableCost = form.conferenceTable ? 12000 : 0;
  const overheadFileCabinetCost = form.overheadFileCabinet ? 4000 : 0;
  const epoxyFlooringCost = form.epoxyFlooring ? area * 80 : 0;

  const calculatedCost =
    steelCost +
    sheetMetalCost +
    flooringCost +
    electricalCost +
    paintingCost +
    doorCost +
    windowCost +
    partitionCost +
    laborCost +
    transportCost +
    toiletCost +
    insulationCost +
    glassDoorCost +
    falseCeilingCost +
    bedCost +
    bunkBedCost +
    workstationCost +
    managerialTableCost +
    conferenceTableCost +
    overheadFileCabinetCost +
    epoxyFlooringCost;

  const gst = safeNumber(form.priceBeforeGst) * (GST_PERCENT / 100);
  const finalPrice = safeNumber(form.priceBeforeGst) + gst;
  const advancePaymentValue =
    finalPrice * (safeNumber(form.advancePaymentPercentage) / 100);
  const balancePayment = finalPrice - advancePaymentValue;

  return {
    area,
    steelCost,
    sheetMetalCost,
    flooringCost,
    electricalCost,
    paintingCost,
    doorCost,
    windowCost,
    partitionCost,
    laborCost,
    transportCost,
    toiletCost,
    insulationCost,
    glassDoorCost,
    falseCeilingCost,
    bedCost,
    bunkBedCost,
    workstationCost,
    managerialTableCost,
    conferenceTableCost,
    overheadFileCabinetCost,
    epoxyFlooringCost,
    calculatedCost,
    gst,
    finalPrice,
    advancePaymentValue,
    balancePayment,
  };
}
