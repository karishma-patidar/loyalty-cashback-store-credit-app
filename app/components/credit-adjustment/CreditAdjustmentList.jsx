/* eslint-disable react/prop-types, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
import { useState, useCallback, useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import {
  Card,
  Button,
  InlineStack,
  BlockStack,
  Text,
  Box,
  EmptyState,
  Modal,
  Pagination,
  Badge,
  ChoiceList,
  useSetIndexFiltersMode,
  IndexFiltersMode,
  IndexFilters,
  IndexTable,
  Banner,
  RadioButton,
  TextField,
  Select,
  Checkbox,
  DatePicker,
  Popover,
  Icon,
  Link,
  Spinner,
  InlineGrid,
} from "@shopify/polaris";

const CalendarIconSvg = () => (
  <svg viewBox="0 0 20 20" style={{ width: "20px", height: "20px", fill: "var(--p-color-icon)" }}>
    <path fillRule="evenodd" d="M6 2a.75.75 0 0 1 .75.75V4h6.5V2.75a.75.75 0 0 1 1.5 0V4h.75A2.25 2.25 0 0 1 18 6.25v8.5A2.25 2.25 0 0 1 15.75 17H4.25A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4H5V2.75A.75.75 0 0 1 6 2Zm9.75 6.5H4.25v6.25c0 .414.336.75.75.75h10.75a.75.75 0 0 0 .75-.75V8.5Z" clipRule="evenodd" />
  </svg>
);

function nodeContainsDescendant(rootNode, descendant) {
  if (rootNode === descendant) {
    return true;
  }
  let parent = descendant.parentNode;
  while (parent != null) {
    if (parent === rootNode) {
      return true;
    }
    parent = parent.parentNode;
  }
  return false;
}

function formatDate(dateInput) {
  if (!dateInput) return "-";
  const date = new Date(dateInput);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(dateInput) {
  if (!dateInput) return "-";
  const date = new Date(dateInput);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}


export default function CreditAdjustmentList({
  adjustments,
  totalPages,
  currentPage,
  searchQuery,
  filterType,
  filterStatus,
  sortSelected,
  bulkJob,
  shopCurrency,
  enabledCurrencies,
  shopSubdomain,
  onFilterChange,
  onPageChange,
  onApplySingle,
  onRefresh,
  searchFetcher,
  isRefreshing,
}) {
  const [searchVal, setSearchVal] = useState(searchQuery);
  const [typeFilter, setTypeFilter] = useState([filterType]);
  const [statusFilter, setStatusFilter] = useState([filterStatus]);
  const [sortSelectedVal, setSortSelectedVal] = useState([sortSelected]);

  const { mode, setMode } = useSetIndexFiltersMode();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [adjustType, setAdjustType] = useState("Credit"); // "Credit" | "Debit"
  const [adjustFor, setAdjustFor] = useState("Customer"); // "Customer" | "CompanyLocation"
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Selector Searches
  const initialCustomersFetcher = useFetcher();
  const initialLocationsFetcher = useFetcher();
  const [initialCustomers, setInitialCustomers] = useState([]);
  const [initialLocations, setInitialLocations] = useState([]);
  const [hasTypedCustomer, setHasTypedCustomer] = useState(false);
  const [hasTypedLocation, setHasTypedLocation] = useState(false);

  const [customerSearchVal, setCustomerSearchVal] = useState("");
  const [customerList, setCustomerList] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [locationSearchVal, setLocationSearchVal] = useState("");
  const [locationList, setLocationList] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Form Fields
  const [selectedCurrency, setSelectedCurrency] = useState(shopCurrency);
  const [amountVal, setAmountVal] = useState("10");
  const [reasonVal, setReasonVal] = useState("");
  const [expirationOption, setExpirationOption] = useState("NoExpiration"); // "NoExpiration" | "SetExpiration"
  const [{ month, year }, setDateState] = useState({
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
  });
  const [selectedDate, setSelectedDate] = useState(null);
  const [notifyCustomer, setNotifyCustomer] = useState(false);

  const datePickerRef = useRef(null);
  const customerContainerRef = useRef(null);
  const locationContainerRef = useRef(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  useEffect(() => {
    function handleClickOutside(event) {
      if (customerContainerRef.current && !customerContainerRef.current.contains(event.target)) {
        setShowCustomerDropdown(false);
      }
      if (locationContainerRef.current && !locationContainerRef.current.contains(event.target)) {
        setShowLocationDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      if (adjustFor === "Customer") {
        initialCustomersFetcher.load(`/app/credit-adjustment?actionType=searchCustomers&query=`);
      } else {
        initialLocationsFetcher.load(`/app/credit-adjustment?actionType=searchCompanyLocations&query=`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, adjustFor]);

  // Debounced Customer & Location Search
  const debouncedSearchRef = useRef(null);
  useEffect(() => {
    if (!selectedCustomer && hasTypedCustomer && customerSearchVal.trim() !== "") {
      if (debouncedSearchRef.current) clearTimeout(debouncedSearchRef.current);
      debouncedSearchRef.current = setTimeout(() => {
        searchFetcher.load(
          `/app/credit-adjustment?actionType=searchCustomers&query=${encodeURIComponent(
            customerSearchVal
          )}`
        );
      }, 300);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerSearchVal, selectedCustomer, hasTypedCustomer]);

  useEffect(() => {
    if (!selectedLocation && hasTypedLocation && locationSearchVal.trim() !== "") {
      if (debouncedSearchRef.current) clearTimeout(debouncedSearchRef.current);
      debouncedSearchRef.current = setTimeout(() => {
        searchFetcher.load(
          `/app/credit-adjustment?actionType=searchCompanyLocations&query=${encodeURIComponent(
            locationSearchVal
          )}`
        );
      }, 300);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationSearchVal, selectedLocation, hasTypedLocation]);

  useEffect(() => {
    if (searchFetcher.data) {
      if (adjustFor === "Customer") {
        setCustomerList(searchFetcher.data);
      } else {
        setLocationList(searchFetcher.data);
      }
    }
  }, [searchFetcher.data, adjustFor]);

  useEffect(() => {
    if (initialCustomersFetcher.data) {
      setInitialCustomers(initialCustomersFetcher.data);
    }
  }, [initialCustomersFetcher.data]);

  useEffect(() => {
    if (initialLocationsFetcher.data) {
      setInitialLocations(initialLocationsFetcher.data);
    }
  }, [initialLocationsFetcher.data]);

  useEffect(() => {
    if (selectedDate) {
      setDateState({
        month: selectedDate.getMonth(),
        year: selectedDate.getFullYear(),
      });
    }
  }, [selectedDate]);

  const resetForm = () => {
    setAdjustType("Credit");
    setAdjustFor("Customer");
    setCustomerSearchVal("");
    setCustomerList([]);
    setSelectedCustomer(null);
    setLocationSearchVal("");
    setLocationList([]);
    setSelectedLocation(null);
    setSelectedCurrency(shopCurrency);
    setAmountVal("10");
    setReasonVal("");
    setExpirationOption("NoExpiration");
    setSelectedDate(null);
    setNotifyCustomer(false);
    setIsCalendarOpen(false);
    setHasTypedCustomer(false);
    setHasTypedLocation(false);
  };

  const handleOpenModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleApply = () => {
    const ownerId = adjustFor === "Customer" ? selectedCustomer?.id : selectedLocation?.id;
    const ownerName = adjustFor === "Customer" ? selectedCustomer?.name : selectedLocation?.name;
    const ownerEmail = adjustFor === "Customer" ? selectedCustomer?.email : undefined;

    onApplySingle({
      adjustmentType: adjustType,
      ownerType: adjustFor,
      id: ownerId,
      name: ownerName,
      email: ownerEmail,
      amount: amountVal,
      currencyCode: selectedCurrency,
      reason: reasonVal,
      expiresAt: expirationOption === "SetExpiration" && selectedDate ? selectedDate.toISOString() : null,
      notifyCustomer: adjustType === "Debit" ? false : notifyCustomer,
    }, () => {
      setIsModalOpen(false);
    });
  };

  function isNodeWithinPopover(node) {
    return datePickerRef?.current
      ? nodeContainsDescendant(datePickerRef.current, node)
      : false;
  }

  function handleOnClose({ relatedTarget }) {
    if (relatedTarget && isNodeWithinPopover(relatedTarget)) {
      return;
    }
    setIsCalendarOpen(false);
  }

  function handleMonthChange(m, y) {
    setDateState({ month: m, year: y });
  }

  function handleDateSelection({ end: newSelectedDate }) {
    setSelectedDate(newSelectedDate);
    setIsCalendarOpen(false);
  }

  // Filter handlers
  const handleQueryChange = useCallback((value) => {
    setSearchVal(value);
    onFilterChange("query", value);
  }, [onFilterChange]);

  const handleTypeFilterChange = useCallback((value) => {
    setTypeFilter(value);
    onFilterChange("type", value[0]);
  }, [onFilterChange]);

  const handleStatusFilterChange = useCallback((value) => {
    setStatusFilter(value);
    onFilterChange("status", value[0]);
  }, [onFilterChange]);

  const handleSortChange = useCallback((value) => {
    setSortSelectedVal(value);
    onFilterChange("sort", value[0]);
  }, [onFilterChange]);

  // Form Validation
  const isSelected = adjustFor === "Customer" ? !!selectedCustomer : !!selectedLocation;
  const isAmountValid = parseFloat(amountVal) > 0 && !isNaN(parseFloat(amountVal));
  const isReasonValid = reasonVal.trim().length > 0;
  const isDateValid = adjustType === "Debit" || expirationOption === "NoExpiration" || (expirationOption === "SetExpiration" && selectedDate !== null);
  const isApplyDisabled = !isSelected || !isAmountValid || !isReasonValid || !isDateValid;

  // Sorting Options
  const sortOptions = [
    { label: "Date: Newest to oldest", value: "date-desc" },
    { label: "Date: Oldest to newest", value: "date-asc" },
    { label: "Amount: High to low", value: "amount-desc" },
    { label: "Amount: Low to high", value: "amount-asc" },
  ];

  // Filters setup
  const filters = [
    {
      key: "type",
      label: "Adjustment Type",
      filter: (
        <ChoiceList
          title="Adjustment Type"
          titleHidden
          choices={[
            { label: "All", value: "all" },
            { label: "Credit (+)", value: "Credit" },
            { label: "Debit (-)", value: "Debit" },
          ]}
          selected={typeFilter}
          onChange={handleTypeFilterChange}
        />
      ),
      shortcut: true,
    },
    {
      key: "status",
      label: "Status",
      filter: (
        <ChoiceList
          title="Status"
          titleHidden
          choices={[
            { label: "All", value: "all" },
            { label: "Success", value: "Success" },
            { label: "Failed", value: "Failed" },
          ]}
          selected={statusFilter}
          onChange={handleStatusFilterChange}
        />
      ),
      shortcut: true,
    },
  ];

  const appliedFilters = [];
  if (typeFilter[0] !== "all") {
    appliedFilters.push({
      key: "type",
      label: `Type: ${typeFilter[0]}`,
      onRemove: () => handleTypeFilterChange(["all"]),
    });
  }
  if (statusFilter[0] !== "all") {
    appliedFilters.push({
      key: "status",
      label: `Status: ${statusFilter[0]}`,
      onRemove: () => handleStatusFilterChange(["all"]),
    });
  }

  // Currency select list options
  const currencyOptions = enabledCurrencies.map((c) => ({ label: c, value: c }));

  const displayCustomers = hasTypedCustomer ? customerList : initialCustomers;
  const displayLocations = hasTypedLocation ? locationList : initialLocations;

  return (
    <BlockStack gap="base">
      {/* Recent Bulk Adjustment Job Card */}
      {bulkJob && (() => {
        const isProcessing = bulkJob.status === "Processing" || bulkJob.status === "Pending";
        if (isProcessing) {
          return (
            <Card>
              <BlockStack gap="base">
                <Text variant="headingMd" as="h2">
                  Your bulk adjustment is being processed.
                </Text>
                <InlineStack gap="tight" blockAlign="center">
                  <Spinner size="small" />
                  <Text variant="bodyMd" as="span">
                    processing {bulkJob.totalRecords} transactions.
                  </Text>
                </InlineStack>
                <Banner tone="info">
                  <p>
                    This may take some time to complete, feel free to switch tabs and continue with other tasks.
                  </p>
                </Banner>
              </BlockStack>
            </Card>
          );
        }

        return (
          <Card>
            <BlockStack gap="base">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h2">
                  Recent bulk adjustment
                </Text>
                {bulkJob.status === "Completed" && (
                  <Badge tone="success">Completed</Badge>
                )}
                {bulkJob.status === "Failed" && (
                  <Badge tone="critical">Failed</Badge>
                )}
              </InlineStack>

              <Text variant="bodyMd" as="p">
                {bulkJob.processed} of {bulkJob.totalRecords} transactions processed successfully on{" "}
                {formatDate(bulkJob.updatedAt)}.
              </Text>

              {bulkJob.status === "Completed" && bulkJob.failedCount > 0 && (
                <Banner tone="warning" title="There were transaction errors due to invalid data or other issues">
                  <p>
                    Please review the transaction history for more details or click below to download your job results file.
                  </p>
                  <Box paddingBlockStart="base">
                    <Button
                      onClick={() => {
                        if (!bulkJob?.resultsCsv) return;
                        const blob = new Blob([bulkJob.resultsCsv], { type: "text/csv" });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `bulk_adjustment_results_${bulkJob.id}.csv`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                      }}
                    >
                      Download results
                    </Button>
                  </Box>
                </Banner>
              )}

              {bulkJob.status === "Completed" && bulkJob.failedCount === 0 && (
                <Banner tone="success" title="Bulk adjustment completed successfully!">
                  <p>All CSV records have been correctly processed and applied.</p>
                  <Box paddingBlockStart="base">
                    <Button
                      onClick={() => {
                        if (!bulkJob?.resultsCsv) return;
                        const blob = new Blob([bulkJob.resultsCsv], { type: "text/csv" });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `bulk_adjustment_results_${bulkJob.id}.csv`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                      }}
                    >
                      Download results
                    </Button>
                  </Box>
                </Banner>
              )}

              {bulkJob.status === "Failed" && (
                <Banner tone="critical" title="Bulk adjustment job failed">
                  <p>{bulkJob.errorMessage || "A critical system error occurred during processing."}</p>
                </Banner>
              )}
            </BlockStack>
          </Card>
        );
      })()}

      {/* History Table Index Table */}
      <Card padding="0">
        <IndexFilters
          loading={isRefreshing}
          queryValue={searchVal}
          queryPlaceholder="Search adjustments by customer name, location or reason"
          onQueryChange={handleQueryChange}
          onQueryClear={() => handleQueryChange("")}
          tabs={[]}
          selected={0}
          onSelect={() => {}}
          filters={filters}
          appliedFilters={appliedFilters}
          onClearAll={() => {
            setTypeFilter(["all"]);
            setStatusFilter(["all"]);
            onFilterChange("clearAll");
          }}
          cancelAction={{
            onAction: () => setMode(IndexFiltersMode.Default),
          }}
          mode={mode}
          setMode={setMode}
          sortOptions={sortOptions}
          sortSelected={sortSelectedVal}
          onSortChange={handleSortChange}
          canCreateNewView={false}
        />

        {adjustments.length === 0 ? (
          <EmptyState
            heading="No adjustments recorded yet"
            action={{ content: "Adjust store credit", onAction: handleOpenModal }}
            secondaryAction={{
              content: "Bulk adjust",
              onAction: onRefresh, // will be redirected or handled
            }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>Add manual adjustments to customer account balances or upload a CSV file in bulk.</p>
          </EmptyState>
        ) : (
          <BlockStack gap="base">
            <IndexTable
              resourceName={{ singular: "adjustment", plural: "adjustments" }}
              itemCount={adjustments.length}
              selectable={false}
              headings={[
                { title: "ID" },
                { title: "Adjusted Date" },
                { title: "Customer / Company Location" },
                { title: "Amount" },
                { title: "Expiration Date" },
                { title: "Status" },
                { title: "Email Status" },
                { title: "Reason" },
              ]}
            >
              {adjustments.map((adj) => {
                const isCredit = adj.adjustmentType === "Credit";
                const ownerName = adj.customerId ? adj.customerName : adj.companyLocationName;

                const cleanOwnerId = adj.customerId
                  ? adj.customerId.split("/").pop()
                  : adj.companyLocationId?.split("/").pop();

                const cleanCompanyId = adj.companyId?.split("/").pop();

                const ownerUrl = adj.customerId
                  ? `https://admin.shopify.com/store/${shopSubdomain}/customers/${cleanOwnerId}`
                  : cleanCompanyId
                  ? `https://admin.shopify.com/store/${shopSubdomain}/companies/${cleanCompanyId}/locations/${cleanOwnerId}`
                  : `https://admin.shopify.com/store/${shopSubdomain}/companies`;

                return (
                  <IndexTable.Row id={adj.id} key={adj.id} position={parseInt(adj.id, 10) || 0}>
                    <IndexTable.Cell>
                      <Text variant="bodyMd" fontWeight="bold" as="span">
                        {/^\d+$/.test(adj.id) ? adj.id : adj.id.slice(0, 6)}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>{formatDate(adj.createdAt)}</IndexTable.Cell>
                    <IndexTable.Cell>
                      <a href={ownerUrl} target="_blank" rel="noopener noreferrer">
                        <Text variant="bodyMd" fontWeight="bold" as="span">
                          {ownerName}
                        </Text>
                      </a>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text
                        variant="bodyMd"
                        fontWeight="bold"
                        as="span"
                        tone={isCredit ? "success" : "critical"}
                      >
                        {isCredit ? "+" : "-"}
                        {Number(adj.amount).toString()} {adj.currency}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      {adj.expirationDate ? formatDateOnly(adj.expirationDate) : "-"}
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Badge tone={adj.status === "Success" ? "success" : "critical"}>
                        {adj.status}
                      </Badge>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      {adj.emailStatus ? (
                        <Badge tone={adj.emailStatus === "Sent" ? "success" : "subdued"}>
                          {adj.emailStatus}
                        </Badge>
                      ) : null}
                    </IndexTable.Cell>
                    <IndexTable.Cell>{adj.reason}</IndexTable.Cell>
                  </IndexTable.Row>
                );
              })}
            </IndexTable>

            {totalPages > 1 && (
              <Box padding="base" style={{ display: "flex", justifyContent: "center" }}>
                <Pagination
                  hasPrevious={currentPage > 1}
                  onPrevious={() => onPageChange(currentPage - 1)}
                  hasNext={currentPage < totalPages}
                  onNext={() => onPageChange(currentPage + 1)}
                />
              </Box>
            )}
          </BlockStack>
        )}
      </Card>

      {/* Adjust Single Account Modal */}
      <Modal
        open={isModalOpen}
        onClose={handleCloseModal}
        title="Adjust single account"
        primaryAction={{
          content: "Apply",
          onAction: handleApply,
          disabled: isApplyDisabled,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: handleCloseModal,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="base">
            {/* Adjustment Type */}
            <BlockStack gap="tight">
              <Text variant="bodyMd" fontWeight="bold">
                Adjustment type
              </Text>
              <BlockStack gap="tight">
                <RadioButton
                  label="Credit (+)"
                  checked={adjustType === "Credit"}
                  onChange={() => setAdjustType("Credit")}
                />
                <RadioButton
                  label="Debit (-)"
                  checked={adjustType === "Debit"}
                  onChange={() => setAdjustType("Debit")}
                />
              </BlockStack>
            </BlockStack>

            {/* Adjustment For */}
            <BlockStack gap="tight">
              <Text variant="bodyMd" fontWeight="bold">
                Adjustment for
              </Text>
              <BlockStack gap="tight">
                <RadioButton
                  label="Customer"
                  checked={adjustFor === "Customer"}
                  onChange={() => {
                    setAdjustFor("Customer");
                    setLocationSearchVal("");
                    setLocationList([]);
                    setSelectedLocation(null);
                    setHasTypedLocation(false);
                  }}
                />
                <RadioButton
                  label="Company location"
                  checked={adjustFor === "CompanyLocation"}
                  onChange={() => {
                    setAdjustFor("CompanyLocation");
                    setCustomerSearchVal("");
                    setCustomerList([]);
                    setSelectedCustomer(null);
                    setHasTypedCustomer(false);
                  }}
                />
              </BlockStack>
            </BlockStack>

            {/* Customer Search */}
            {adjustFor === "Customer" && (
              <div ref={customerContainerRef} style={{ position: "relative", zIndex: showCustomerDropdown ? 999 : 1 }}>
                <BlockStack gap="tight">
                  <div
                    onClick={() => {
                      setSelectedCustomer(null);
                      setShowCustomerDropdown(true);
                      setHasTypedCustomer(false);
                    }}
                  >
                    <TextField
                      label="Customer email"
                      value={customerSearchVal}
                      onFocus={() => {
                        setSelectedCustomer(null);
                        setShowCustomerDropdown(true);
                        setHasTypedCustomer(false);
                      }}
                      onChange={(val) => {
                        setCustomerSearchVal(val);
                        setSelectedCustomer(null);
                        setShowCustomerDropdown(true);
                        if (val.trim() === "") {
                          setHasTypedCustomer(false);
                        } else {
                          setHasTypedCustomer(true);
                        }
                      }}
                      placeholder="Enter customer email or search by name"
                      autoComplete="new-password"
                    />
                  </div>
                
                  {showCustomerDropdown && !selectedCustomer && (
                    <Box
                      borderRadius="base"
                      style={{
                        border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
                        maxHeight: "220px",
                        overflowY: "auto",
                        position: "absolute",
                        width: "100%",
                        zIndex: 9999,
                        top: "100%",
                        marginTop: "4px",
                        boxShadow: "var(--p-shadow-300, 0px 4px 12px rgba(0, 0, 0, 0.08))",
                        backgroundColor: "var(--p-color-bg-surface, #ffffff)",
                      }}
                    >
                      <div style={{ padding: "4px 0" }}>
                        {searchFetcher.state === "loading" && (
                          <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
                            <Spinner size="small" />
                          </div>
                        )}
                        {displayCustomers.length > 0 ? (
                          <BlockStack gap="extraTight">
                            {displayCustomers.map((cust) => (
                              <Box
                                as="div"
                                key={cust.id}
                                onClick={() => {
                                  setSelectedCustomer(cust);
                                  setCustomerSearchVal(cust.email || cust.name);
                                  setShowCustomerDropdown(false);
                                }}
                                style={{ cursor: "pointer", padding: "8px 16px" }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--p-color-bg-surface-hover, #f1f2f3)")}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                              >
                                <BlockStack gap="extraTight">
                                  <Text variant="bodyMd" fontWeight="semibold">{cust.name}</Text>
                                  <Text variant="bodySm" tone="subdued">{cust.email}</Text>
                                </BlockStack>
                              </Box>
                            ))}
                          </BlockStack>
                        ) : (
                          <div style={{ padding: "12px 16px" }}>
                            <Text variant="bodyMd" tone="subdued">
                              No match found.
                            </Text>
                          </div>
                        )}
                      </div>
                    </Box>
                  )}
                </BlockStack>
              </div>
            )}

            {/* Company Location Search */}
            {adjustFor === "CompanyLocation" && (
              <div ref={locationContainerRef} style={{ position: "relative", zIndex: showLocationDropdown ? 999 : 1 }}>
                <BlockStack gap="tight">
                  <div
                    onClick={() => {
                      setSelectedLocation(null);
                      setShowLocationDropdown(true);
                      setHasTypedLocation(false);
                    }}
                  >
                    <TextField
                      label="Company location"
                      value={locationSearchVal}
                      onFocus={() => {
                        setSelectedLocation(null);
                        setShowLocationDropdown(true);
                        setHasTypedLocation(false);
                      }}
                      onChange={(val) => {
                        setLocationSearchVal(val);
                        setSelectedLocation(null);
                        setShowLocationDropdown(true);
                        if (val.trim() === "") {
                          setHasTypedLocation(false);
                        } else {
                          setHasTypedLocation(true);
                        }
                      }}
                      placeholder="Search by company location name"
                      autoComplete="new-password"
                    />
                  </div>

                  {showLocationDropdown && !selectedLocation && (
                    <Box
                      borderRadius="base"
                      style={{
                        border: "1px solid var(--p-color-border-subdued, #e1e3e5)",
                        maxHeight: "220px",
                        overflowY: "auto",
                        position: "absolute",
                        width: "100%",
                        zIndex: 9999,
                        top: "100%",
                        marginTop: "4px",
                        boxShadow: "var(--p-shadow-300, 0px 4px 12px rgba(0, 0, 0, 0.08))",
                        backgroundColor: "var(--p-color-bg-surface, #ffffff)",
                      }}
                    >
                      <div style={{ padding: "4px 0" }}>
                        {searchFetcher.state === "loading" && (
                          <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
                            <Spinner size="small" />
                          </div>
                        )}
                        {displayLocations.length > 0 ? (
                          <BlockStack gap="extraTight">
                            {displayLocations.map((loc) => (
                              <Box
                                as="div"
                                key={loc.id}
                                onClick={() => {
                                  setSelectedLocation(loc);
                                  setLocationSearchVal(loc.name);
                                  setShowLocationDropdown(false);
                                }}
                                style={{ cursor: "pointer", padding: "8px 16px" }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--p-color-bg-surface-hover, #f1f2f3)")}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                              >
                                <Text variant="bodyMd" fontWeight="semibold">{loc.name} - Company: {loc.companyName}</Text>
                              </Box>
                            ))}
                          </BlockStack>
                        ) : (
                          <div style={{ padding: "12px 16px" }}>
                            <Text variant="bodyMd" tone="subdued">
                              No match found.
                            </Text>
                          </div>
                        )}
                      </div>
                    </Box>
                  )}
                </BlockStack>
              </div>
            )}

            <InlineGrid columns={["oneThird", "twoThirds"]} gap="base">
              <Select
                label="Currency"
                options={currencyOptions}
                value={selectedCurrency}
                onChange={setSelectedCurrency}
              />
              <TextField
                label="Amount"
                type="number"
                value={amountVal}
                onChange={(val) => {
                  const clean = val.replace(/[^0-9.]/g, "");
                  const parts = clean.split(".");
                  if (parts[1] && parts[1].length > 2) {
                    setAmountVal(`${parts[0]}.${parts[1].slice(0, 2)}`);
                  } else {
                    setAmountVal(clean);
                  }
                }}
                prefix={adjustType === "Credit" ? "+" : "-"}
                suffix={selectedCurrency}
                placeholder="0.00"
                autoComplete="off"
              />
            </InlineGrid>

            {/* Reason */}
            <TextField
              label="Reason"
              value={reasonVal}
              onChange={setReasonVal}
              placeholder="Enter reason for the adjustment"
              multiline={3}
              autoComplete="off"
            />

   {/* Notify customer */}
             {adjustType !== "Debit" && (
               <BlockStack gap="tight">
                 <Checkbox
                   label="Notify customers via Shopify notifications"
                   checked={notifyCustomer}
                   onChange={setNotifyCustomer}
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
             )}
             
            {/* Expiration date options (Credits only) */}
            {adjustType === "Credit" && (
              <BlockStack gap="tight">
                <Text variant="bodyMd" fontWeight="bold">
                  Expiration date
                </Text>
                <BlockStack gap="tight">
                  <RadioButton
                    label="No expiration date"
                    checked={expirationOption === "NoExpiration"}
                    onChange={() => {
                      setExpirationOption("NoExpiration");
                      setSelectedDate(null);
                    }}
                  />
                  <RadioButton
                    label="Set expiration date"
                    checked={expirationOption === "SetExpiration"}
                    onChange={() => {
                      setExpirationOption("SetExpiration");
                      if (!selectedDate) {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        setSelectedDate(tomorrow);
                      }
                    }}
                  />
                </BlockStack>

                {expirationOption === "SetExpiration" && (
                  <Box paddingBlockStart="tight">
                    <Popover
                      active={isCalendarOpen}
                      autofocusTarget="none"
                      preferredAlignment="left"
                      preferInputActivator={false}
                      preferredPosition="below"
                      preventCloseOnChildOverlayClick
                      onClose={handleOnClose}
                      activator={
                        <TextField
                          role="combobox"
                          label="Expiration date"
                          labelHidden
                          prefix={<Icon source={CalendarIconSvg} />}
                          value={selectedDate ? selectedDate.toISOString().slice(0, 10) : ""}
                          onFocus={() => setIsCalendarOpen(true)}
                          onChange={() => {}}
                          autoComplete="off"
                        />
                      }
                    >
                      <Card ref={datePickerRef}>
                        <DatePicker
                          month={month}
                          year={year}
                          selected={selectedDate}
                          onMonthChange={handleMonthChange}
                          onChange={handleDateSelection}
                          disableDatesBefore={new Date(new Date().setHours(0, 0, 0, 0))}
                        />
                      </Card>
                    </Popover>
                  </Box>
                )}
              </BlockStack>
            )}

          
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Button to open single modal directly */}
      <div style={{ display: "none" }}>
        <button id="trigger-single-modal-btn" onClick={handleOpenModal}>Trigger</button>
      </div>
    </BlockStack>
  );
}
