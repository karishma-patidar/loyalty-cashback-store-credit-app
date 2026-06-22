/* eslint-disable react/prop-types */
import { useState, useCallback } from "react";
import {
  Card,
  BlockStack,
  Text,
  Box,
  Banner,
  ProgressBar,
  RadioButton,
  Checkbox,
  InlineStack,
  DropZone,
  Link,
  Button,
  Badge,
  Modal,
  IndexTable,
  Pagination,
  List,
} from "@shopify/polaris";

function parseCSV(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push('');
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      lines.push(row);
      row = [''];
    } else {
      row[row.length - 1] += char;
    }
  }
  if (row.length > 1 || row[0] !== '') {
    lines.push(row);
  }
  return lines;
}

function parseCSVData(csvText) {
  const lines = parseCSV(csvText);
  if (lines.length < 2) {
    throw new Error("CSV file must contain a header row and at least one data row.");
  }
  const headers = lines[0].map(h => h.trim().toLowerCase());
  const emailIdx = headers.indexOf("email");
  const currencyIdx = headers.indexOf("currency");
  const amountIdx = headers.indexOf("amount");
  const reasonIdx = headers.indexOf("reason");
  const expiresIdx = headers.indexOf("expiration_date");

  const eIdx = emailIdx !== -1 ? emailIdx : 0;
  const cIdx = currencyIdx !== -1 ? currencyIdx : 1;
  const aIdx = amountIdx !== -1 ? amountIdx : 2;
  const rIdx = reasonIdx !== -1 ? reasonIdx : 3;
  const exIdx = expiresIdx !== -1 ? expiresIdx : 4;

  const dataRows = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.length === 0 || (row.length === 1 && row[0].trim() === "")) {
      continue;
    }
    const email = row[eIdx]?.trim() || "";
    const currency = row[cIdx]?.trim() || "";
    const amount = row[aIdx]?.trim() || "";
    const reason = row[rIdx]?.trim() || "";
    const expirationDate = row[exIdx]?.trim() || "";

    if (email || amount || currency || reason) {
      dataRows.push({
        email,
        currency,
        amount,
        reason,
        expirationDate,
      });
    }
  }
  return dataRows;
}

export default function BulkAdjustForm({
  activeJob,
  onStartUpload,
  onDownloadTemplate,
  onDownloadResults,
  onBack,
  errorMessage,
  setErrorMessage,
  isSubmitting,
  shopSubdomain,
}) {
  const [adjustType, setAdjustType] = useState("Credit"); // "Credit" | "Debit"
  const [notifyCustomers, setNotifyCustomers] = useState(false);

  // CSV Preview & Confirmation States
  const [parsedData, setParsedData] = useState(null);
  const [fileName, setFileName] = useState("");
  const [rawCsvText, setRawCsvText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);


  // File Drop Zone handler
  const handleDropZoneDrop = useCallback(
    (_dropFiles, acceptedFiles) => {
      setErrorMessage("");
      if (acceptedFiles.length === 0) {
        setErrorMessage("Only CSV files are accepted.");
        return;
      }
      const acceptedFile = acceptedFiles[0];
      if (acceptedFile.size > 10 * 1024 * 1024) {
        setErrorMessage("File exceeds 10MB limit.");
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const csvText = e.target?.result;
        if (typeof csvText === "string") {
          try {
            const dataRows = parseCSVData(csvText);
            if (dataRows.length === 0) {
              setErrorMessage("No valid data rows found in the CSV file.");
              setParsedData(null);
              return;
            }
            setParsedData(dataRows);
            setFileName(acceptedFile.name);
            setRawCsvText(csvText);
            setCurrentPage(1);
          } catch (err) {
            setErrorMessage("Failed to parse CSV file: " + err.message);
            setParsedData(null);
          }
        }
      };
      reader.readAsText(acceptedFile);
    },
    [setErrorMessage]
  );

  const handleConfirm = () => {
    onStartUpload({
      csvText: rawCsvText,
      adjustmentType: adjustType,
      notifyCustomers,
    });
  };

  return (
    <BlockStack gap="base">
      {/* Active Job Tracker */}
      {activeJob && (
        <Card>
          <BlockStack gap="base">
            <InlineStack align="space-between">
              <Text variant="headingMd" as="h2">
                Processing adjustments
              </Text>
              {activeJob.status === "Pending" && <Badge tone="warning">Pending</Badge>}
              {activeJob.status === "Processing" && <Badge tone="info">Processing</Badge>}
              {activeJob.status === "Completed" && <Badge tone="success">Completed</Badge>}
              {activeJob.status === "Failed" && <Badge tone="critical">Failed</Badge>}
            </InlineStack>

            <Text variant="bodyMd" as="p">
              Processed {activeJob.processed} of {activeJob.totalRecords} records.
            </Text>

            {activeJob.status === "Processing" && (
              <ProgressBar
                progress={
                  activeJob.totalRecords > 0
                    ? (activeJob.processed / activeJob.totalRecords) * 100
                    : 0
                }
              />
            )}

            {activeJob.status === "Completed" && (
              <BlockStack gap="base">
                {activeJob.failedCount > 0 ? (
                  <Banner tone="warning" title="Some records failed validation or processing">
                    <p>
                      Processed successfully: {activeJob.successCount}. Failed: {activeJob.failedCount}.
                      Download the results CSV to inspect details of failures.
                    </p>
                  </Banner>
                ) : (
                  <Banner tone="success" title="Bulk adjustment completed successfully!">
                    <p>All {activeJob.successCount} records processed correctly.</p>
                  </Banner>
                )}
                <InlineStack gap="base">
                  <Button onClick={onDownloadResults}>Download results</Button>
                  <Button variant="primary" onClick={onBack}>
                    Back to Adjustment History
                  </Button>
                </InlineStack>
              </BlockStack>
            )}

            {activeJob.status === "Failed" && (
              <Banner tone="critical" title="Job execution failed">
                <p>{activeJob.errorMessage || "A system error occurred."}</p>
              </Banner>
            )}
          </BlockStack>
        </Card>
      )}

      {/* CSV Upload form card */}
      {!activeJob && (
        <Card>
          <BlockStack gap="loose">
            {/* Adjustment Type - Stacked radio buttons */}
            <BlockStack gap="tight">
              <Text variant="bodyMd" fontWeight="bold">
                Adjustment type
              </Text>
              <BlockStack gap="tight">
                <RadioButton
                  label="Credit (+)"
                  checked={adjustType === "Credit"}
                  onChange={() => setAdjustType("Credit")}
                  disabled={isSubmitting}
                />
                <RadioButton
                  label="Debit (-)"
                  checked={adjustType === "Debit"}
                  onChange={() => setAdjustType("Debit")}
                  disabled={isSubmitting}
                />
              </BlockStack>
            </BlockStack>

            {/* Template Download */}
            <Box>
              <Button onClick={onDownloadTemplate} disabled={isSubmitting}>
                Download CSV template
              </Button>
            </Box>

            {/* Notification toggle with link */}
            <BlockStack gap="base">
              <Checkbox
                label="Notify customers via Shopify notifications"
                checked={notifyCustomers}
                onChange={setNotifyCustomers}
                disabled={isSubmitting}
              />
              <Box paddingInlineStart="6">
                <Text tone="subdued" variant="bodySm">
                  <Link url={`https://admin.shopify.com/store/${(() => {
                    if (typeof window !== "undefined") {
                      const params = new URLSearchParams(window.location.search);
                      const shop = params.get("shop");
                      if (shop) return shop.split(".")[0];
                    }
                    return shopSubdomain || "loyalty-store-credit";
                  })()}/email_templates/store_credit_issued/preview`} target="_blank">
                    Customize email content
                  </Link>{" "}
                  in Customer notifications.
                </Text>
              </Box>
            </BlockStack>

            {/* Drag and Drop Zone */}
            <BlockStack gap="tight">
              <Box style={{ height: "140px" }}>
                <DropZone
                  accept=".csv"
                  type="file"
                  onDrop={handleDropZoneDrop}
                  errorOverlayText="CSV files only"
                  disabled={isSubmitting}
                >
                  <DropZone.FileUpload actionHint="Accepts .csv files only" />
                </DropZone>
              </Box>
              {errorMessage && (
                <Box paddingBlockStart="base">
                  <Banner tone="critical" title={errorMessage} />
                </Box>
              )}
            </BlockStack>

            {/* CSV Data Preview */}
            {parsedData && (
              <Box paddingBlockStart="base">
                <BlockStack gap="base">
                  <Text variant="headingMd" as="h3">
                    {fileName}
                  </Text>
                  <IndexTable
                    resourceName={{ singular: "record", plural: "records" }}
                    itemCount={parsedData.length}
                    selectable={false}
                    headings={[
                      { title: "Email" },
                      { title: "Amount" },
                      { title: "Currency" },
                      { title: "Reason" },
                      { title: "Expiration date (YYYY-MM-DD)" },
                    ]}
                  >
                    {(() => {
                      const rowsPerPage = 5;
                      const startIndex = (currentPage - 1) * rowsPerPage;
                      const paginatedRows = parsedData.slice(startIndex, startIndex + rowsPerPage);
                      return paginatedRows.map((row, index) => {
                        const globalIndex = startIndex + index;
                        const amt = parseFloat(row.amount) || 0;
                        const isPositive = adjustType === "Credit";
                        return (
                          <IndexTable.Row
                            id={String(globalIndex)}
                            key={globalIndex}
                            position={globalIndex}
                          >
                            <IndexTable.Cell>
                              <Text variant="bodyMd" fontWeight="bold" as="span">
                                {row.email}
                              </Text>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <Text
                                variant="bodyMd"
                                fontWeight="bold"
                                as="span"
                                tone={isPositive ? "success" : "critical"}
                              >
                                {isPositive ? "+" : "-"}
                                {Math.abs(amt).toString()}
                              </Text>
                            </IndexTable.Cell>
                            <IndexTable.Cell>{row.currency?.toUpperCase()}</IndexTable.Cell>
                            <IndexTable.Cell>{row.reason}</IndexTable.Cell>
                            <IndexTable.Cell>{row.expirationDate || ""}</IndexTable.Cell>
                          </IndexTable.Row>
                        );
                      });
                    })()}
                  </IndexTable>

                  {/* Pagination */}
                  {(() => {
                    const rowsPerPage = 5;
                    const totalPages = Math.ceil(parsedData.length / rowsPerPage);
                    if (totalPages <= 1) return null;
                    return (
                      <Box padding="base" style={{ display: "flex", justifyContent: "center" }}>
                        <Pagination
                          hasPrevious={currentPage > 1}
                          onPrevious={() => setCurrentPage(currentPage - 1)}
                          hasNext={currentPage < totalPages}
                          onNext={() => setCurrentPage(currentPage + 1)}
                        />
                      </Box>
                    );
                  })()}

                  {/* Review Banner */}
                  {(() => {
                    const totalTransactions = parsedData.length;
                    const uniqueEmails = new Set(
                      parsedData.map((r) => r.email.trim().toLowerCase()).filter(Boolean)
                    );
                    const totalCustomers = uniqueEmails.size;

                    const currencySums = {};
                    parsedData.forEach((r) => {
                      const cur = r.currency.trim().toUpperCase() || "USD";
                      const amt = Math.abs(parseFloat(r.amount)) || 0;
                      currencySums[cur] = (currencySums[cur] || 0) + amt;
                    });

                    const totalAmountStr = Object.entries(currencySums)
                      .map(([cur, sum]) => `${Number(sum.toFixed(2))} ${cur}`)
                      .join(", ");

                    const isCredit = adjustType === "Credit";

                    return (
                      <Banner tone="warning" title="Please review your data before proceeding:">
                        <List>
                          <List.Item>
                            <Text as="span">Adjustment type: {isCredit ? "Credit (+)" : "Debit (-)"}</Text>
                          </List.Item>
                          <List.Item>
                            <Text as="span">Total transactions: {totalTransactions}</Text>
                          </List.Item>
                          <List.Item>
                            <Text as="span">Total customers: {totalCustomers}</Text>
                          </List.Item>
                          <List.Item>
                            <Text as="span">
                              {isCredit
                                ? "Total store credit will be issued: "
                                : "Total store credit will be deducted: "}
                              {totalAmountStr || "0 USD"}
                            </Text>
                          </List.Item>
                        </List>
                      </Banner>
                    );
                  })()}

                  {/* Apply Button */}
                  <Box paddingBlockStart="base" style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button variant="primary" onClick={() => setIsConfirmModalOpen(true)}>
                      Apply
                    </Button>
                  </Box>
                </BlockStack>
              </Box>
            )}

            {/* Confirmation Modal */}
            {isConfirmModalOpen && (
              <Modal
                open={isConfirmModalOpen}
                onClose={() => {
                  if (!isSubmitting) setIsConfirmModalOpen(false);
                }}
                title="Apply bulk adjustment"
                primaryAction={{
                  content: "Confirm",
                  onAction: handleConfirm,
                  loading: isSubmitting,
                  disabled: isSubmitting,
                }}
                secondaryActions={[
                  {
                    content: "Close",
                    onAction: () => setIsConfirmModalOpen(false),
                    disabled: isSubmitting,
                  },
                ]}
              >
                <Modal.Section>
                  <Text>Are you sure you want to apply this bulk adjustment?</Text>
                </Modal.Section>
              </Modal>
            )}
          </BlockStack>
        </Card>
      )}
    </BlockStack>
  );
}
