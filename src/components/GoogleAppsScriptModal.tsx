import React, { useState } from 'react';
import { X, Copy, Check, FileCode, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { triggerHaptic } from '../utils/storage';

interface GoogleAppsScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  scriptUrl: string;
}

export const APPS_SCRIPT_CODE = `/**
 * Google Apps Script for Meter & Infra Tracker with Google Drive Photo Storage
 * 
 * 1. Google Drive Folder: "Meter_Infra_Photos"
 *    - All Old Meter, New Meter & Device photos are saved as JPG files in this Drive folder.
 *    - Clickable Google Drive links are added into the Google Sheet columns.
 * 
 * 2. Tab "Technicians":
 *    - Column A: Technician Names
 *    - Column B: Password / PIN (Default PIN: 1234)
 *    - Column C: New Meter Makes (Genus, Secure, L&T, HPL, etc.)
 *    - Column D: Company Name (Genus, Tata Power, BSES, etc.)
 *    - Column E: Vertical (PPM, Pvvnl, BB, PUVVNL, NPCL, ATL, etc.)
 * 
 * 3. Tab "Meter": Meter installation records (includes Company & Vertical)
 * 4. Tab "Infra": Infra installation records (includes Company & Vertical)
 */

// Helper function to decode Base64 image and save to Google Drive folder
function savePhotoToDrive(dataUri, fileName, folderName) {
  if (!dataUri || typeof dataUri !== 'string' || dataUri.indexOf('base64,') === -1) {
    return dataUri || "";
  }
  try {
    var parts = dataUri.split('base64,');
    var contentType = parts[0].split(':')[1].split(';')[0];
    var decoded = Utilities.base64Decode(parts[1]);
    var blob = Utilities.newBlob(decoded, contentType, fileName);

    var targetFolderName = folderName || "Meter_Infra_Photos";
    var folders = DriveApp.getFoldersByName(targetFolderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(targetFolderName);

    var file = folder.createFile(blob);
    // Make viewable via link
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    return "Drive Error: " + err.toString();
  }
}

// Helper function to update Technicians tab with all dropdowns and passwords
// PRESERVES existing sheet data: never wipes out existing columns unless explicitly updated
function handleUpdateConfig(ss, parsedPayload) {
  var techSheet = ss.getSheetByName("Technicians");
  if (!techSheet) {
    techSheet = ss.insertSheet("Technicians");
  }
  
  // Set headers in Row 1 if missing
  techSheet.getRange(1, 1, 1, 5).setValues([["Technician Name", "Password / PIN", "New Meter Makes", "Company Name", "Vertical"]]);

  // Read existing columns from sheet first so existing data is NEVER lost!
  var existingData = [];
  if (techSheet.getLastRow() > 1) {
    existingData = techSheet.getRange(2, 1, techSheet.getLastRow() - 1, 5).getValues();
  }

  var existingTechNames = [];
  var existingPassMap = {};
  var existingMakes = [];
  var existingComps = [];
  var existingVerts = [];

  for (var eIdx = 0; eIdx < existingData.length; eIdx++) {
    var eRow = existingData[eIdx];
    var eT = eRow[0] ? String(eRow[0]).trim() : "";
    var eP = eRow[1] ? String(eRow[1]).trim() : "";
    var eM = eRow[2] ? String(eRow[2]).trim() : "";
    var eC = eRow[3] ? String(eRow[3]).trim() : "";
    var eV = eRow[4] ? String(eRow[4]).trim() : "";

    if (eT && existingTechNames.indexOf(eT) === -1) {
      existingTechNames.push(eT);
      if (eP) existingPassMap[eT] = eP;
    }
    if (eM && existingMakes.indexOf(eM) === -1) existingMakes.push(eM);
    if (eC && existingComps.indexOf(eC) === -1) existingComps.push(eC);
    if (eV && existingVerts.indexOf(eV) === -1) existingVerts.push(eV);
  }

  // Determine what columns to write:
  var techNames = existingTechNames;
  if (parsedPayload.replaceTechnicians === true && Array.isArray(parsedPayload.technicians)) {
    techNames = parsedPayload.technicians;
  } else if (Array.isArray(parsedPayload.technicians) && parsedPayload.technicians.length > 0) {
    techNames = parsedPayload.technicians;
  }

  var techPassMap = existingPassMap;
  if (parsedPayload.technicianPasswords && typeof parsedPayload.technicianPasswords === 'object') {
    techPassMap = parsedPayload.technicianPasswords;
  }

  var makes = existingMakes;
  if (parsedPayload.replaceMeterMakes === true && Array.isArray(parsedPayload.meterMakes)) {
    makes = parsedPayload.meterMakes;
  } else if (Array.isArray(parsedPayload.meterMakes) && parsedPayload.meterMakes.length > 0) {
    makes = parsedPayload.meterMakes;
  } else if (Array.isArray(parsedPayload.makes) && parsedPayload.makes.length > 0) {
    makes = parsedPayload.makes;
  }

  var comps = existingComps;
  if (parsedPayload.replaceCompanies === true && Array.isArray(parsedPayload.companies)) {
    comps = parsedPayload.companies;
  } else if (Array.isArray(parsedPayload.companies) && parsedPayload.companies.length > 0) {
    comps = parsedPayload.companies;
  }

  var verts = existingVerts;
  if (parsedPayload.replaceVerticals === true && Array.isArray(parsedPayload.verticals)) {
    verts = parsedPayload.verticals;
  } else if (Array.isArray(parsedPayload.verticals) && parsedPayload.verticals.length > 0) {
    verts = parsedPayload.verticals;
  }

  var maxRows = Math.max(techNames.length, makes.length, comps.length, verts.length, 1);
  
  // Clear all data rows starting from row 2 down to the end of the sheet
  var maxRowsInSheet = Math.max(techSheet.getLastRow(), techSheet.getMaxRows());
  if (maxRowsInSheet > 1) {
    techSheet.getRange(2, 1, maxRowsInSheet - 1, 5).clearContent();
  }

  var rowsToWrite = [];
  for (var rIdx = 0; rIdx < maxRows; rIdx++) {
    var tName = techNames[rIdx] ? String(techNames[rIdx]).trim() : "";
    var tPass = "";
    if (tName) {
      tPass = techPassMap[tName] ? String(techPassMap[tName]).trim() : (existingPassMap[tName] || "1234");
    }
    var mMake = makes[rIdx] ? String(makes[rIdx]).trim() : "";
    var cComp = comps[rIdx] ? String(comps[rIdx]).trim() : "";
    var vVert = verts[rIdx] ? String(verts[rIdx]).trim() : "";
    rowsToWrite.push([tName, tPass, mMake, cComp, vVert]);
  }

  if (rowsToWrite.length > 0) {
    techSheet.getRange(2, 1, rowsToWrite.length, 5).setValues(rowsToWrite);
  }

  return {
    status: "success",
    message: "Google Sheet 'Technicians' tab updated successfully! (" + techNames.length + " technicians, " + makes.length + " makes, " + comps.length + " companies, " + verts.length + " verticals)",
    technicians: techNames,
    meterMakes: makes,
    companies: comps,
    verticals: verts,
    timestamp: new Date().toISOString()
  };
}

// Helper function to update an existing record in Meter or Infra sheet
function handleUpdateRecord(ss, record) {
  if (!record) return { status: "error", message: "No record provided" };

  if (record.type === "MeterInstallation") {
    var meterSheet = ss.getSheetByName("Meter") || ss.getSheetByName("Sheet1") || ss.getActiveSheet();
    if (!meterSheet || meterSheet.getLastRow() < 2) {
      return { status: "error", message: "No data in Meter sheet" };
    }

    var lastRow = meterSheet.getLastRow();
    var lastCol = Math.max(meterSheet.getLastColumn(), 14);
    var values = meterSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    var targetId = record.id ? String(record.id).trim() : "";
    var targetOrigMeter = record.originalNewMeterNo ? String(record.originalNewMeterNo).trim().toUpperCase() : "";
    var targetNewMeter = record.newMeterNo ? String(record.newMeterNo).trim().toUpperCase() : "";

    var matchRowIndex = -1;
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var rowId = row[13] ? String(row[13]).trim() : "";
      var rowMeterNo = row[9] ? String(row[9]).trim().toUpperCase() : "";

      if ((targetId && rowId === targetId) ||
          (targetOrigMeter && rowMeterNo === targetOrigMeter) ||
          (targetNewMeter && rowMeterNo === targetNewMeter)) {
        matchRowIndex = i + 2;
        break;
      }
    }

    if (matchRowIndex > 0) {
      var existingRowValues = meterSheet.getRange(matchRowIndex, 1, 1, 14).getValues()[0];
      var oldPhoto = record.oldMeterPhotoUrl || existingRowValues[8] || "";
      var newPhoto = record.newMeterPhotoUrl || existingRowValues[11] || "";

      meterSheet.getRange(matchRowIndex, 1, 1, 14).setValues([[
        record.installationDate || record.timestamp || existingRowValues[0],
        record.technicianName || existingRowValues[1],
        record.company || existingRowValues[2],
        record.vertical || existingRowValues[3],
        record.siteName || existingRowValues[4],
        record.flatNo || existingRowValues[5],
        record.oldMeterNo || existingRowValues[6],
        record.oldMeterMake || existingRowValues[7],
        oldPhoto,
        record.newMeterNo || existingRowValues[9],
        record.newMeterMake || record.meterMake || existingRowValues[10],
        newPhoto,
        record.remark !== undefined ? record.remark : existingRowValues[12],
        record.id || existingRowValues[13] || ""
      ]]);

      return {
        status: "success",
        message: "Meter record updated in Google Sheet (Row " + matchRowIndex + ")",
        row: matchRowIndex
      };
    }

    return { status: "error", message: "Matching record not found in Meter sheet" };
  } else if (record.type === "InfraInstallation") {
    var infraSheet = ss.getSheetByName("Infra") || ss.getSheetByName("InfraInstallation");
    if (!infraSheet || infraSheet.getLastRow() < 2) {
      return { status: "error", message: "No data in Infra sheet" };
    }

    var lastRow = infraSheet.getLastRow();
    var lastCol = Math.max(infraSheet.getLastColumn(), 11);
    var values = infraSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    var targetId = record.id ? String(record.id).trim() : "";
    var targetOrigDev = record.originalDeviceNo ? String(record.originalDeviceNo).trim().toUpperCase() : "";
    var targetDevNo = record.deviceNo ? String(record.deviceNo).trim().toUpperCase() : "";

    var matchRowIndex = -1;
    for (var j = 0; j < values.length; j++) {
      var row = values[j];
      var rowId = row[10] ? String(row[10]).trim() : "";
      var rowDevNo = row[6] ? String(row[6]).trim().toUpperCase() : "";

      if ((targetId && rowId === targetId) ||
          (targetOrigDev && rowDevNo === targetOrigDev) ||
          (targetDevNo && rowDevNo === targetDevNo)) {
        matchRowIndex = j + 2;
        break;
      }
    }

    if (matchRowIndex > 0) {
      var existingRowValues = infraSheet.getRange(matchRowIndex, 1, 1, 11).getValues()[0];
      var devPhoto = record.devicePhotoUrl || existingRowValues[8] || "";

      infraSheet.getRange(matchRowIndex, 1, 1, 11).setValues([[
        record.installationDate || record.timestamp || existingRowValues[0],
        record.technicianName || existingRowValues[1],
        record.company || existingRowValues[2],
        record.vertical || existingRowValues[3],
        record.siteName || existingRowValues[4],
        record.towerNo || record.deviceLocation || existingRowValues[5],
        record.deviceNo || existingRowValues[6],
        record.infraQty || existingRowValues[7],
        devPhoto,
        record.remark !== undefined ? record.remark : existingRowValues[9],
        record.id || existingRowValues[10] || ""
      ]]);

      return {
        status: "success",
        message: "Infra record updated in Google Sheet (Row " + matchRowIndex + ")",
        row: matchRowIndex
      };
    }

    return { status: "error", message: "Matching record not found in Infra sheet" };
  }

  return { status: "error", message: "Unknown record type: " + record.type };
}

// Helper function to delete an existing record in Meter or Infra sheet
function handleDeleteRecord(ss, payload) {
  if (!payload) return { status: "error", message: "No delete payload provided" };

  var recordType = payload.type;
  var recordId = payload.recordId ? String(payload.recordId).trim() : "";
  var meterNo = payload.newMeterNo ? String(payload.newMeterNo).trim().toUpperCase() : "";
  var devNo = payload.deviceNo ? String(payload.deviceNo).trim().toUpperCase() : "";

  if (recordType === "MeterInstallation" || meterNo) {
    var meterSheet = ss.getSheetByName("Meter") || ss.getSheetByName("Sheet1") || ss.getActiveSheet();
    if (meterSheet && meterSheet.getLastRow() >= 2) {
      var lastRow = meterSheet.getLastRow();
      var lastCol = Math.max(meterSheet.getLastColumn(), 14);
      var values = meterSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

      for (var i = 0; i < values.length; i++) {
        var row = values[i];
        var rowId = row[13] ? String(row[13]).trim() : "";
        var rowMeterNo = row[9] ? String(row[9]).trim().toUpperCase() : "";

        if ((recordId && rowId === recordId) || (meterNo && rowMeterNo === meterNo)) {
          meterSheet.deleteRow(i + 2);
          return {
            status: "success",
            message: "Meter record " + (meterNo || recordId) + " deleted from Google Sheet row " + (i + 2)
          };
        }
      }
    }
  }

  if (recordType === "InfraInstallation" || devNo) {
    var infraSheet = ss.getSheetByName("Infra") || ss.getSheetByName("InfraInstallation");
    if (infraSheet && infraSheet.getLastRow() >= 2) {
      var lastRow = infraSheet.getLastRow();
      var lastCol = Math.max(infraSheet.getLastColumn(), 11);
      var values = infraSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

      for (var j = 0; j < values.length; j++) {
        var row = values[j];
        var rowId = row[10] ? String(row[10]).trim() : "";
        var rowDevNo = row[6] ? String(row[6]).trim().toUpperCase() : "";

        if ((recordId && rowId === recordId) || (devNo && rowDevNo === devNo)) {
          infraSheet.deleteRow(j + 2);
          return {
            status: "success",
            message: "Infra record " + (devNo || recordId) + " deleted from Google Sheet row " + (j + 2)
          };
        }
      }
    }
  }

  return { status: "error", message: "Record not found in Google Sheet for deletion" };
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "getTechnicians";
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Support updating configuration via GET (avoids CORS preflight issues)
  if (action === "updateConfig") {
    var payload = null;
    try {
      if (e && e.parameter && e.parameter.payload) {
        payload = JSON.parse(e.parameter.payload);
      } else if (e && e.parameter && e.parameter.data) {
        payload = JSON.parse(e.parameter.data);
      }
    } catch (parseErr) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Invalid payload JSON: " + parseErr.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (payload) {
      var updateResult = handleUpdateConfig(ss, payload);
      return ContentService.createTextOutput(JSON.stringify(updateResult)).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // Support updating an existing record via GET
  if (action === "updateRecord") {
    var recPayload = null;
    try {
      if (e && e.parameter && e.parameter.payload) {
        recPayload = JSON.parse(e.parameter.payload);
      } else if (e && e.parameter && e.parameter.data) {
        recPayload = JSON.parse(e.parameter.data);
      }
    } catch (parseErr) {}
    if (recPayload) {
      var rec = recPayload.record || recPayload;
      var updRes = handleUpdateRecord(ss, rec);
      return ContentService.createTextOutput(JSON.stringify(updRes)).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // Support deleting an existing record via GET
  if (action === "deleteRecord") {
    var delPayload = null;
    try {
      if (e && e.parameter && e.parameter.payload) {
        delPayload = JSON.parse(e.parameter.payload);
      } else if (e && e.parameter && e.parameter.data) {
        delPayload = JSON.parse(e.parameter.data);
      }
    } catch (parseErr) {}
    if (delPayload) {
      var delRes = handleDeleteRecord(ss, delPayload);
      return ContentService.createTextOutput(JSON.stringify(delRes)).setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === "getTechnicians" || action === "getDropdowns") {
    var sheet = ss.getSheetByName("Technicians");
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Sheet 'Technicians' not found"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var data = sheet.getDataRange().getValues();
    var technicians = [];
    var meterMakes = [];
    var companies = [];
    var verticals = [];
    var technicianPasswords = {};
    var technicianAccounts = [];

    // Row 0 is Header, starting from Row 1
    for (var i = 1; i < data.length; i++) {
      var techName = data[i][0] ? String(data[i][0]).trim() : "";
      var pass = data[i][1] ? String(data[i][1]).trim() : "";
      var make = data[i][2] ? String(data[i][2]).trim() : "";
      var company = data[i][3] ? String(data[i][3]).trim() : "";
      var vertical = data[i][4] ? String(data[i][4]).trim() : "";

      // Column A = Technician Name
      if (techName !== "") {
        technicians.push(techName);
        // Column B = Password / PIN
        if (pass !== "") {
          technicianPasswords[techName] = pass;
          technicianAccounts.push({ name: techName, password: pass });
        }
      }

      // Column C = New Meter Make
      if (make !== "") {
        meterMakes.push(make);
      }

      // Column D = Company Name
      if (company !== "") {
        companies.push(company);
      }

      // Column E = Vertical
      if (vertical !== "") {
        verticals.push(vertical);
      }
    }

    // Unique values
    technicians = technicians.filter(function(v, idx, self) { return self.indexOf(v) === idx; });
    meterMakes = meterMakes.filter(function(v, idx, self) { return self.indexOf(v) === idx; });
    companies = companies.filter(function(v, idx, self) { return self.indexOf(v) === idx; });
    verticals = verticals.filter(function(v, idx, self) { return self.indexOf(v) === idx; });

    // Helper to get today's date formatted as YYYY-MM-DD in IST
    var todayIstStr = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd");

    function extractDatePart(dateVal) {
      if (!dateVal) return "";
      if (Object.prototype.toString.call(dateVal) === '[object Date]') {
        return Utilities.formatDate(dateVal, "Asia/Kolkata", "yyyy-MM-dd");
      }
      var s = String(dateVal).trim();
      var dm = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
      if (dm) {
        var d = dm[1].length === 1 ? "0" + dm[1] : dm[1];
        var m = dm[2].length === 1 ? "0" + dm[2] : dm[2];
        return dm[3] + "-" + m + "-" + d;
      }
      var ym = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (ym) {
        var m2 = ym[2].length === 1 ? "0" + ym[2] : ym[2];
        var d2 = ym[3].length === 1 ? "0" + ym[3] : ym[3];
        return ym[1] + "-" + m2 + "-" + d2;
      }
      return "";
    }

    // 1. Total Meter Install & Today Meter Install from "Meter" sheet
    var totalMeterInstall = 0;
    var todayMeterInstall = 0;
    var existingMeterNos = [];
    var sheetRecords = [];
    var meterSheet = ss.getSheetByName("Meter") || ss.getSheetByName("Sheet1");
    if (meterSheet && meterSheet.getLastRow() > 1) {
      // Columns: A=Timestamp(0), B=Tech(1), C=Company(2), D=Vertical(3), E=Site(4), F=Flat(5), G=OldMeter(6), H=OldMake(7), I=OldPhoto(8), J=NewMeter(9), K=NewMake(10), L=NewPhoto(11), M=Remark(12), N=ID(13)
      var maxMeterCols = Math.max(meterSheet.getLastColumn(), 14);
      var meterRange = meterSheet.getRange(2, 1, meterSheet.getLastRow() - 1, maxMeterCols).getValues();
      for (var m = 0; m < meterRange.length; m++) {
        var mRow = meterRange[m];
        var timeStampVal = mRow[0];
        var siteNameVal = mRow[4] ? String(mRow[4]).trim() : "";
        var newMeterVal = mRow[9] ? String(mRow[9]).trim().toUpperCase() : "";

        // Count as valid meter install if New Meter No or Site Name is present
        if (newMeterVal !== "" || siteNameVal !== "") {
          totalMeterInstall += 1;
          if (newMeterVal !== "") existingMeterNos.push(newMeterVal);

          // Check if installed Today
          var recDate = extractDatePart(timeStampVal);
          if (recDate === todayIstStr) {
            todayMeterInstall += 1;
          }

          sheetRecords.push({
            id: mRow[13] ? String(mRow[13]).trim() : ("meter_" + m + "_" + newMeterVal),
            type: "MeterInstallation",
            installationDate: timeStampVal ? String(timeStampVal) : "",
            timestamp: timeStampVal ? String(timeStampVal) : "",
            technicianName: mRow[1] ? String(mRow[1]).trim() : "",
            company: mRow[2] ? String(mRow[2]).trim() : "",
            vertical: mRow[3] ? String(mRow[3]).trim() : "",
            siteName: siteNameVal,
            flatNo: mRow[5] ? String(mRow[5]).trim() : "",
            oldMeterNo: mRow[6] ? String(mRow[6]).trim() : "",
            oldMeterMake: mRow[7] ? String(mRow[7]).trim() : "",
            oldMeterPhoto: mRow[8] ? String(mRow[8]).trim() : null,
            newMeterNo: newMeterVal,
            newMeterMake: mRow[10] ? String(mRow[10]).trim() : "",
            newMeterPhoto: mRow[11] ? String(mRow[11]).trim() : null,
            remark: mRow[12] ? String(mRow[12]).trim() : "",
            status: "synced"
          });
        }
      }
    }

    // 2. Total Infra Install & Today Infra Install from "Infra" sheet (SUM Column H / infraQty)
    var totalInfraInstall = 0;
    var todayInfraInstall = 0;
    var existingDeviceNos = [];
    var infraSheet = ss.getSheetByName("Infra") || ss.getSheetByName("InfraInstallation");
    if (infraSheet && infraSheet.getLastRow() > 1) {
      // Columns: A=Timestamp(0), B=Tech(1), C=Company(2), D=Vertical(3), E=Site(4), F=DeviceLoc(5), G=DeviceNo(6), H=InfraQty(7), I=Photo(8), J=Remark(9), K=ID(10)
      var maxInfraCols = Math.max(infraSheet.getLastColumn(), 11);
      var infraRange = infraSheet.getRange(2, 1, infraSheet.getLastRow() - 1, maxInfraCols).getValues();
      for (var d = 0; d < infraRange.length; d++) {
        var iRow = infraRange[d];
        var iTimeStamp = iRow[0];
        var devNo = iRow[6] ? String(iRow[6]).trim().toUpperCase() : "";
        var siteVal = iRow[4] ? String(iRow[4]).trim() : "";
        var qtyRaw = iRow[7]; // Column H = Infra Qty
        var qtyNum = 1;
        if (qtyRaw !== undefined && qtyRaw !== null && qtyRaw !== "") {
          var parsedQty = parseFloat(String(qtyRaw).replace(/[^0-9.-]/g, ""));
          qtyNum = isNaN(parsedQty) || parsedQty <= 0 ? 1 : parsedQty;
        }

        if (devNo !== "" || siteVal !== "") {
          if (devNo !== "") existingDeviceNos.push(devNo);
          totalInfraInstall += qtyNum;

          var iDate = extractDatePart(iTimeStamp);
          if (iDate === todayIstStr) {
            todayInfraInstall += qtyNum;
          }

          sheetRecords.push({
            id: iRow[10] ? String(iRow[10]).trim() : ("infra_" + d + "_" + devNo),
            type: "InfraInstallation",
            installationDate: iTimeStamp ? String(iTimeStamp) : "",
            timestamp: iTimeStamp ? String(iTimeStamp) : "",
            technicianName: iRow[1] ? String(iRow[1]).trim() : "",
            company: iRow[2] ? String(iRow[2]).trim() : "",
            vertical: iRow[3] ? String(iRow[3]).trim() : "",
            siteName: siteVal,
            towerNo: iRow[5] ? String(iRow[5]).trim() : "",
            deviceLocation: iRow[5] ? String(iRow[5]).trim() : "",
            deviceNo: devNo,
            infraQty: String(qtyNum),
            devicePhoto: iRow[8] ? String(iRow[8]).trim() : null,
            remark: iRow[9] ? String(iRow[9]).trim() : "",
            status: "synced"
          });
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      technicians: technicians,
      technicianPasswords: technicianPasswords,
      technicianAccounts: technicianAccounts,
      meterMakes: meterMakes,
      makes: meterMakes,
      companies: companies,
      verticals: verticals,
      existingMeterNos: existingMeterNos,
      existingDeviceNos: existingDeviceNos,
      sheetRecords: sheetRecords,
      sheetStats: {
        totalMeterInstall: totalMeterInstall,
        todayMeterInstall: todayMeterInstall,
        totalInfraInstall: totalInfraInstall,
        todayInfraInstall: todayInfraInstall
      }
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // Safe fallback response - never throw missing HTML error
  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Google Apps Script API is active",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var meterSheet = ss.getSheetByName("Meter") || ss.getSheetByName("Sheet1") || ss.getActiveSheet();
    var infraSheet = ss.getSheetByName("Infra") || ss.getSheetByName("InfraInstallation");

    var contents = "";
    if (e && e.postData && e.postData.contents) {
      contents = e.postData.contents;
    } else if (e && e.parameter && e.parameter.payload) {
      contents = e.parameter.payload;
    } else if (e && e.parameter && e.parameter.data) {
      contents = e.parameter.data;
    }

    var parsedPayload = null;
    try {
      if (contents) {
        parsedPayload = JSON.parse(contents);
      }
    } catch (parseErr) {
      parsedPayload = null;
    }

    // Support for Admin Portal Direct Configuration Sync (Technicians, Passwords, Companies, Verticals, Makes)
    if (parsedPayload && (parsedPayload.action === "updateConfig" || (e && e.parameter && e.parameter.action === "updateConfig"))) {
      var configResult = handleUpdateConfig(ss, parsedPayload);
      return ContentService.createTextOutput(JSON.stringify(configResult)).setMimeType(ContentService.MimeType.JSON);
    }

    // Support for Update Record from History Tab (same ID / meter number)
    if (parsedPayload && (parsedPayload.action === "updateRecord" || (e && e.parameter && e.parameter.action === "updateRecord"))) {
      var updateRec = parsedPayload.record || parsedPayload;
      var updateRecResult = handleUpdateRecord(ss, updateRec);
      return ContentService.createTextOutput(JSON.stringify(updateRecResult)).setMimeType(ContentService.MimeType.JSON);
    }

    // Support for Delete Record from History Tab (same ID / meter number)
    if (parsedPayload && (parsedPayload.action === "deleteRecord" || (e && e.parameter && e.parameter.action === "deleteRecord"))) {
      var deleteRecResult = handleDeleteRecord(ss, parsedPayload);
      return ContentService.createTextOutput(JSON.stringify(deleteRecResult)).setMimeType(ContentService.MimeType.JSON);
    }

    var records = parsedPayload;
    if (!Array.isArray(records)) {
      records = [records];
    }

    // Pre-load existing meter numbers to block duplicate post in sheet
    var sheetMeterMap = {};
    if (meterSheet && meterSheet.getLastRow() > 1) {
      var mRows = meterSheet.getRange(2, 10, meterSheet.getLastRow() - 1, 1).getValues();
      for (var mi = 0; mi < mRows.length; mi++) {
        var mv = mRows[mi][0] ? String(mRows[mi][0]).trim().toUpperCase() : "";
        if (mv) sheetMeterMap[mv] = true;
      }
    }

    // Pre-load existing device numbers to block duplicate post in sheet
    var sheetDeviceMap = {};
    var targetInfra = infraSheet || meterSheet;
    if (targetInfra && targetInfra.getLastRow() > 1) {
      var dRows = targetInfra.getRange(2, 7, targetInfra.getLastRow() - 1, 1).getValues();
      for (var di = 0; di < dRows.length; di++) {
        var dv = dRows[di][0] ? String(dRows[di][0]).trim().toUpperCase() : "";
        if (dv) sheetDeviceMap[dv] = true;
      }
    }

    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      var now = new Date();
      var timePrefix = Utilities.formatDate(now, "Asia/Kolkata", "yyyyMMdd_HHmmss");
      var defaultIstDate = Utilities.formatDate(now, "Asia/Kolkata", "dd/MM/yyyy, hh:mm:ss a");
      var recordDate = r.installationDate || r.timestamp || defaultIstDate;

      if (r.type === "MeterInstallation") {
        var newMeterKey = r.newMeterNo ? String(r.newMeterNo).trim().toUpperCase() : "";
        if (newMeterKey && sheetMeterMap[newMeterKey]) {
          return ContentService.createTextOutput(JSON.stringify({
            status: "error",
            message: "Duplicate Meter Number! " + r.newMeterNo + " already exists in Google Sheet!"
          })).setMimeType(ContentService.MimeType.JSON);
        }

        // Save Old Meter Photo in Google Drive
        var oldPhotoUrl = "";
        if (r.oldMeterPhoto) {
          var oldName = "OldMeter_" + (r.flatNo || "flat") + "_" + (r.oldMeterNo || "meter") + "_" + timePrefix + ".jpg";
          oldPhotoUrl = savePhotoToDrive(r.oldMeterPhoto, oldName, "Meter_Infra_Photos");
        }

        // Save New Meter Photo in Google Drive
        var newPhotoUrl = "";
        if (r.newMeterPhoto) {
          var newName = "NewMeter_" + (r.flatNo || "flat") + "_" + (r.newMeterNo || "meter") + "_" + timePrefix + ".jpg";
          newPhotoUrl = savePhotoToDrive(r.newMeterPhoto, newName, "Meter_Infra_Photos");
        }

        // 1. Installation Date, Tech, Company, Vertical, Site, Flat, OldMeter, OldMake, OldPhotoUrl, NewMeter, NewMake, NewPhotoUrl, Remark
        meterSheet.appendRow([
          recordDate,
          r.technicianName || "",
          r.company || "",
          r.vertical || "",
          r.siteName || "",
          r.flatNo || "",
          r.oldMeterNo || "",
          r.oldMeterMake || "",
          oldPhotoUrl,
          r.newMeterNo || "",
          r.newMeterMake || r.meterMake || "",
          newPhotoUrl,
          r.remark || "",
          r.id || ""
        ]);
        if (newMeterKey) sheetMeterMap[newMeterKey] = true;
      } else if (r.type === "InfraInstallation") {
        var devKey = r.deviceNo ? String(r.deviceNo).trim().toUpperCase() : "";
        if (devKey && sheetDeviceMap[devKey]) {
          return ContentService.createTextOutput(JSON.stringify({
            status: "error",
            message: "Duplicate Device Number! " + r.deviceNo + " already exists in Google Sheet!"
          })).setMimeType(ContentService.MimeType.JSON);
        }

        // Save Device Photo in Google Drive
        var devicePhotoUrl = "";
        if (r.devicePhoto) {
          var devName = "Device_" + (r.deviceLocation || r.towerNo || "loc") + "_" + (r.deviceNo || "dev") + "_" + timePrefix + ".jpg";
          devicePhotoUrl = savePhotoToDrive(r.devicePhoto, devName, "Meter_Infra_Photos");
        }

        var targetSheet = infraSheet || meterSheet;
        // 2. Installation Date, Tech, Company, Vertical, Site, DeviceLocation, DeviceNo, Qty, DevicePhotoUrl, Remark
        targetSheet.appendRow([
          recordDate,
          r.technicianName || "",
          r.company || "",
          r.vertical || "",
          r.siteName || "",
          r.deviceLocation || r.towerNo || "",
          r.deviceNo || "",
          r.infraQty || "",
          devicePhotoUrl,
          r.remark || "",
          r.id || ""
        ]);
        if (devKey) sheetDeviceMap[devKey] = true;
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      count: records.length
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;

export const GoogleAppsScriptModal: React.FC<GoogleAppsScriptModalProps> = ({
  isOpen,
  onClose,
  scriptUrl,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    triggerHaptic(30);
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Google Sheet Apps Script Setup
              </h3>
              <p className="text-xs text-slate-500">
                Sync Technicians, Passwords, Makes, Company & Vertical
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hindi explanation alert */}
        <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl space-y-1.5 text-xs text-indigo-950">
          <div className="flex items-center gap-1.5 font-bold text-indigo-900">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
            "Technicians" Sheet Column Structure:
          </div>
          <p className="space-y-0.5">
            • <strong>Column A</strong>: Technician Name (e.g. Mohit, Abhishek)<br />
            • <strong>Column B</strong>: Password / PIN (Default PIN: 1234)<br />
            • <strong>Column C</strong>: New Meter Make (Genus, Secure, L&T, etc.)<br />
            • <strong>Column D</strong>: Company Name (Genus, Tata Power, BSES, etc.)<br />
            • <strong>Column E</strong>: Vertical (PPM, Pvvnl, BB, etc. - <em>Optional</em>)
          </p>
          <div className="mt-2 pt-2 border-t border-indigo-200/70 text-indigo-900 font-medium">
            📸 <strong>Photos Drive Location:</strong> Saari Old Meter, New Meter aur Device photos aapke Google Drive mein <strong>"Meter_Infra_Photos"</strong> naam ke folder mein JPG format mein save hongi, aur Google Sheet mein clickable link banega.
          </div>
          <p className="text-slate-600 pt-1">
            Google Sheet ke andar <strong>Code.gs</strong> mein niche diya hua code paste karke <strong>Deploy (New Version)</strong> karein.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-2 text-xs text-slate-700">
          <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
            Kaise update karein (Easy 4 Steps):
          </div>
          <ol className="list-decimal list-inside space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <li>
              Apni Google Sheet open karein aur upar <strong>Extensions &gt; Apps Script</strong> par click karein.
            </li>
            <li>
              <strong>Code.gs</strong> mein saara purana code hata kar niche diya hua code paste karein.
            </li>
            <li>
              Top right mein <strong>Deploy &gt; Manage deployments</strong> par click karein.
            </li>
            <li>
              Pencil icon (Edit) dabayein, <strong>Version: New version</strong> select karein aur <strong>Deploy</strong> dabayein!
            </li>
          </ol>
        </div>

        {/* Code Box with Copy Button */}
        <div className="relative rounded-xl border border-slate-200 bg-slate-900 text-slate-100 overflow-hidden text-xs">
          <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
            <span className="font-mono text-[11px] text-slate-300">Code.gs</span>
            <button
              onClick={handleCopy}
              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied Code!' : 'Copy Code'}
            </button>
          </div>
          <pre className="p-3 max-h-56 overflow-y-auto font-mono text-[11px] leading-relaxed text-emerald-300">
            {APPS_SCRIPT_CODE}
          </pre>
        </div>

        <div className="pt-2 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            Close
          </button>
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy Apps Script Code'}
          </button>
        </div>
      </div>
    </div>
  );
};
