/* eslint-disable */
import db from "../db.server";
import connectMongoDB, { getShopModel } from "../db.mongodb.server";

// Shopify Admin Client interface
export interface AdminClient {
  graphql: (query: string, options?: { variables?: any }) => Promise<any>;
}

/**
 * Searches for Shopify customers by name or email, returning their balances
 */
export async function searchCustomers(admin: AdminClient, queryStr: string) {
  const shopifyQuery = queryStr
    ? `#graphql
      query SearchCustomers($query: String!) {
        customers(first: 50, query: $query) {
          edges {
            node {
              id
              displayName
              email
              storeCreditAccounts(first: 10) {
                edges {
                  node {
                    id
                    balance {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        }
      }
    `
    : `#graphql
      query SearchCustomers {
        customers(first: 50) {
          edges {
            node {
              id
              displayName
              email
              storeCreditAccounts(first: 10) {
                edges {
                  node {
                    id
                    balance {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

  const response = await admin.graphql(shopifyQuery, {
    variables: queryStr ? { query: queryStr } : {},
  });
  const data = await response.json();
  const edges = data?.data?.customers?.edges || [];

  return edges.map((edge: any) => {
    const node = edge.node;
    const accounts = node.storeCreditAccounts?.edges || [];
    const balances: Record<string, number> = {};
    accounts.forEach((accEdge: any) => {
      const bal = accEdge.node.balance;
      balances[bal.currencyCode] = parseFloat(bal.amount || "0");
    });

    return {
      id: node.id,
      name: node.displayName || "Unknown Customer",
      email: node.email || "",
      balances,
    };
  });
}

/**
 * Searches for Shopify B2B Company Locations by name
 */
export async function searchCompanyLocations(admin: AdminClient, queryStr: string) {
  const shopifyQuery = queryStr
    ? `#graphql
      query SearchCompanyLocations($query: String!) {
        companyLocations(first: 50, query: $query) {
          edges {
            node {
              id
              name
              company {
                id
                name
              }
              storeCreditAccounts(first: 10) {
                edges {
                  node {
                    id
                    balance {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        }
      }
    `
    : `#graphql
      query SearchCompanyLocations {
        companyLocations(first: 50) {
          edges {
            node {
              id
              name
              company {
                id
                name
              }
              storeCreditAccounts(first: 10) {
                edges {
                  node {
                    id
                    balance {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

  const response = await admin.graphql(shopifyQuery, {
    variables: queryStr ? { query: queryStr } : {},
  });
  const data = await response.json();
  const edges = data?.data?.companyLocations?.edges || [];

  return edges.map((edge: any) => {
    const node = edge.node;
    const accounts = node.storeCreditAccounts?.edges || [];
    const balances: Record<string, number> = {};
    accounts.forEach((accEdge: any) => {
      const bal = accEdge.node.balance;
      balances[bal.currencyCode] = parseFloat(bal.amount || "0");
    });

    return {
      id: node.id,
      name: node.name,
      companyId: node.company?.id || "",
      companyName: node.company?.name || "",
      balances,
    };
  });
}

/**
 * Appends a transaction event to MongoDB customer collection for live sync with widgets/dashboard
 */
async function syncToMongoDB(
  shop: string,
  event: {
    customerId: string;
    customerName: string;
    issuedAmount: number;
    redeemedAmount: number;
    currency: string;
    status: string;
    programType: string;
    reason: string;
    expiresAt: Date | null;
  }
) {
  try {
    await connectMongoDB();
    const ShopModel = getShopModel(shop);
    if (!ShopModel) return;

    let storeDoc = await ShopModel.findOne({ shop });
    if (!storeDoc) {
      storeDoc = await ShopModel.create({ shop, details: new Map() });
    } else if (!storeDoc.details) {
      storeDoc.details = new Map();
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const dateEntry = storeDoc.details.get(todayStr) || { events: [] };
    const events = dateEntry.events || [];

    const uniqueId = `adj-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    events.push({
      shop,
      orderId: uniqueId,
      orderName: event.programType === "credit_adjustment" ? "Credit Adjustment" : "Debit Adjustment",
      customerId: event.customerId,
      customerName: event.customerName,
      issuedAmount: event.issuedAmount,
      currency: event.currency,
      exchangeRate: 1,
      status: event.status,
      emailStatus: event.programType === "debit_adjustment" ? "" : "Sent",
      emailFailReason: "",
      redeemedAmount: event.redeemedAmount,
      programType: event.programType,
      processAt: new Date(),
      expiresAt: event.expiresAt,
      shouldNotify: false,
      programId: "credit-adjustment",
      programName: "Manual Adjustment",
      issuedAt: new Date(),
      createdAt: new Date(),
    });

    storeDoc.details.set(todayStr, { events });
    storeDoc.markModified('details');
    await storeDoc.save();
    console.log(`[MongoDB Sync] Added ${event.programType} transaction event for customer ${event.customerId}`);
  } catch (err) {
    console.error("[MongoDB Sync Error] Failed to sync adjustment transaction:", err);
  }
}

async function generateNumericId(): Promise<string> {
  const adjustments = await db.creditAdjustment.findMany({
    select: { id: true },
  });

  const numericIds = adjustments
    .filter((adj: { id: string }) => /^\d+$/.test(adj.id))
    .map((adj: { id: string }) => parseInt(adj.id, 10));

  let nextId = 756704;
  if (numericIds.length > 0) {
    const maxId = Math.max(...numericIds);
    if (maxId >= nextId) {
      nextId = maxId + 1;
    }
  }

  let idStr = String(nextId);
  let exists = await db.creditAdjustment.findUnique({ where: { id: idStr } });
  while (exists) {
    nextId++;
    idStr = String(nextId);
    exists = await db.creditAdjustment.findUnique({ where: { id: idStr } });
  }

  return idStr;
}

/**
 * Performs a single Credit or Debit adjustment using Shopify GraphQL Admin API
 */
export async function issueCreditAdjustment(
  admin: AdminClient,
  shop: string,
  params: {
    adjustmentType: "Credit" | "Debit";
    ownerType: "Customer" | "CompanyLocation";
    id: string; // Customer GID or CompanyLocation GID
    name: string; // Customer display name or Company Location name
    email?: string; // Customer email
    amount: number;
    currencyCode: string;
    reason: string;
    expiresAt: string | null;
    notifyCustomer: boolean;
    createdBy: string;
  }
) {
  const {
    adjustmentType,
    ownerType,
    id,
    name,
    email,
    amount,
    currencyCode,
    reason,
    expiresAt,
    notifyCustomer,
    createdBy,
  } = params;

  // 1. Check existing balance for owner (to resolve StoreCreditAccount and check debit ceiling)
  let existingAccountId: string | null = null;
  let currentBalance = 0;

  if (ownerType === "Customer") {
    const getAccountQuery = `#graphql
      query getCustomerStoreCreditAccount($id: ID!) {
        customer(id: $id) {
          storeCreditAccounts(first: 10) {
            edges {
              node {
                id
                balance {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    `;
    const res = await admin.graphql(getAccountQuery, { variables: { id } });
    const data = await res.json();
    const accounts = data?.data?.customer?.storeCreditAccounts?.edges || [];
    const matchedAccount = accounts.find((e: any) => e.node.balance.currencyCode === currencyCode);
    if (matchedAccount) {
      existingAccountId = matchedAccount.node.id;
      currentBalance = parseFloat(matchedAccount.node.balance.amount || "0");
    }
  } else {
    const getAccountQuery = `#graphql
      query getCompanyLocationStoreCreditAccount($id: ID!) {
        companyLocation(id: $id) {
          storeCreditAccounts(first: 10) {
            edges {
              node {
                id
                balance {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    `;
    const res = await admin.graphql(getAccountQuery, { variables: { id } });
    const data = await res.json();
    const accounts = data?.data?.companyLocation?.storeCreditAccounts?.edges || [];
    const matchedAccount = accounts.find((e: any) => e.node.balance.currencyCode === currencyCode);
    if (matchedAccount) {
      existingAccountId = matchedAccount.node.id;
      currentBalance = parseFloat(matchedAccount.node.balance.amount || "0");
    }
  }

  // 2. Perform Debit Validation
  if (adjustmentType === "Debit") {
    if (amount > currentBalance) {
      throw new Error(`Insufficient store credit. Available balance is ${currentBalance} ${currencyCode}.`);
    }
    if (!existingAccountId) {
      throw new Error("No active store credit account found for this currency to debit.");
    }
  }

  let transactionId = "";
  let userErrors: any[] = [];

  // 3. Trigger Shopify mutation
  if (adjustmentType === "Credit") {
    const creditMutation = `#graphql
      mutation storeCreditAccountCredit($id: ID!, $creditInput: StoreCreditAccountCreditInput!) {
        storeCreditAccountCredit(id: $id, creditInput: $creditInput) {
          storeCreditAccountTransaction {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const creditVars = {
      id: existingAccountId || id, // can use customer/location GID directly to auto-create
      creditInput: {
        creditAmount: {
          amount: String(amount),
          currencyCode,
        },
        ...(expiresAt ? { expiresAt } : {}),
        notify: notifyCustomer,
      },
    };

    const res = await admin.graphql(creditMutation, { variables: creditVars });
    const data = await res.json();
    const result = data?.data?.storeCreditAccountCredit;
    transactionId = result?.storeCreditAccountTransaction?.id || "";
    userErrors = result?.userErrors || [];
  } else {
    // Debit mutation
    const debitMutation = `#graphql
      mutation storeCreditAccountDebit($id: ID!, $debitInput: StoreCreditAccountDebitInput!) {
        storeCreditAccountDebit(id: $id, debitInput: $debitInput) {
          storeCreditAccountTransaction {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const debitVars = {
      id: existingAccountId, // requires the store credit account ID
      debitInput: {
        debitAmount: {
          amount: String(amount),
          currencyCode,
        },
      },
    };

    const res = await admin.graphql(debitMutation, { variables: debitVars });
    const data = await res.json();
    const result = data?.data?.storeCreditAccountDebit;
    transactionId = result?.storeCreditAccountTransaction?.id || "";
    userErrors = result?.userErrors || [];
  }

  const success = userErrors.length === 0;
  const numericId = await generateNumericId();

  let companyContactEmails: string[] = [];
  let resolvedCompanyId: string | null = null;
  if (ownerType === "CompanyLocation") {
    try {
      const contactsQuery = `#graphql
        query getCompanyLocationContacts($id: ID!) {
          companyLocation(id: $id) {
            company {
              id
              contacts(first: 100) {
                edges {
                  node {
                    customer {
                      email
                    }
                    roleAssignments(first: 50) {
                      edges {
                        node {
                          companyLocation {
                            id
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;
      const res = await admin.graphql(contactsQuery, { variables: { id } });
      const data = await res.json();
      resolvedCompanyId = data?.data?.companyLocation?.company?.id || null;
      const edges = data?.data?.companyLocation?.company?.contacts?.edges || [];
      companyContactEmails = edges
        .map((edge: any) => {
          const node = edge.node;
          const customerEmail = node?.customer?.email;
          const assignments = node?.roleAssignments?.edges || [];
          const isAssignedToThisLocation = assignments.some(
            (assignEdge: any) => assignEdge.node?.companyLocation?.id === id
          );
          return isAssignedToThisLocation ? customerEmail : null;
        })
        .filter((email: any) => email && email.trim() !== "");
    } catch (err) {
      console.error("[issueCreditAdjustment] Error fetching company contacts:", err);
    }
  }

  const hasRecipients = ownerType === "Customer" ? (email && email.trim() !== "") : (companyContactEmails.length > 0);
  const finalEmailStatus = adjustmentType === "Debit"
    ? ""
    : (success && notifyCustomer && hasRecipients ? "Sent" : "Not Sent");

  const finalEmail = ownerType === "Customer" ? email : (companyContactEmails.length > 0 ? companyContactEmails.join(", ") : null);

  // 4. Save to CreditAdjustment SQLite history
  const dbRecord = await db.creditAdjustment.create({
    data: {
      id: numericId,
      shop,
      customerId: ownerType === "Customer" ? id : null,
      customerName: ownerType === "Customer" ? name : null,
      customerEmail: finalEmail,
      companyLocationId: ownerType === "CompanyLocation" ? id : null,
      companyLocationName: ownerType === "CompanyLocation" ? name : null,
      companyId: ownerType === "CompanyLocation" ? resolvedCompanyId : null,
      amount,
      currency: currencyCode,
      adjustmentType,
      reason,
      expirationDate: expiresAt ? new Date(expiresAt) : null,
      status: success ? "Success" : "Failed",
      emailStatus: finalEmailStatus,
      createdBy,
    },
  });

  // 5. Sync event to MongoDB for immediate dashboard reflection
  if (success) {
    await syncToMongoDB(shop, {
      customerId: id,
      customerName: name,
      issuedAmount: adjustmentType === "Credit" ? amount : 0,
      redeemedAmount: adjustmentType === "Debit" ? amount : 0,
      currency: currencyCode,
      status: "Completed",
      programType: adjustmentType === "Credit" ? "credit_adjustment" : "debit_adjustment",
      reason,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });
  }

  if (!success) {
    throw new Error(userErrors[0]?.message || "Shopify transaction failed.");
  }

  return dbRecord;
}

/**
 * Parses CSV text manually to bypass external parser dependencies
 */
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentVal = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(currentVal.trim());
      currentVal = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      row.push(currentVal.trim());
      lines.push(row);
      row = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }
  if (currentVal || row.length > 0) {
    row.push(currentVal.trim());
    lines.push(row);
  }

  return lines;
}

/**
 * Runs bulk adjustment processing job in the background asynchronously
 */
export async function runBulkAdjustmentJobAsync(
  admin: AdminClient,
  shop: string,
  jobId: string,
  csvText: string,
  notifyCustomers: boolean,
  createdBy: string
) {
  try {
    const rows = parseCSV(csvText);
    if (rows.length < 2) {
      await db.bulkAdjustmentJob.update({
        where: { id: jobId },
        data: { status: "Failed", errorMessage: "Empty or invalid CSV file." },
      });
      return;
    }

    const headers = rows[0].map((h) => h.toLowerCase());
    const emailIdx = headers.indexOf("email");
    const currencyIdx = headers.indexOf("currency");
    const amountIdx = headers.indexOf("amount");
    const reasonIdx = headers.indexOf("reason");
    const expiresIdx = headers.indexOf("expiration_date");

    if (emailIdx === -1 || currencyIdx === -1 || amountIdx === -1 || reasonIdx === -1) {
      await db.bulkAdjustmentJob.update({
        where: { id: jobId },
        data: {
          status: "Failed",
          errorMessage: "Missing required columns: email, currency, amount, reason",
        },
      });
      return;
    }

    const dataRows = rows.slice(1).filter((r) => r.length > 0 && r[emailIdx]);
    const totalRecords = dataRows.length;

    await db.bulkAdjustmentJob.update({
      where: { id: jobId },
      data: { totalRecords, status: "Processing" },
    });

    const results: Array<{ email: string; status: string; message: string }> = [];
    let successCount = 0;
    let failedCount = 0;

    // Get job configuration to know type (credit or debit)
    const job = await db.bulkAdjustmentJob.findUnique({ where: { id: jobId } });
    const adjustmentType = (job?.adjustmentType || "Credit") as "Credit" | "Debit";

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const email = row[emailIdx];
      const currency = row[currencyIdx];
      const amountStr = row[amountIdx];
      const reason = row[reasonIdx];
      const expirationDateStr = expiresIdx !== -1 ? row[expiresIdx] : "";

      let success = false;
      let errorMsg = "";

      try {
        // Validate values
        const parsedAmount = parseFloat(amountStr);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          throw new Error("Amount must be a positive number.");
        }

        if (!currency || currency.length !== 3) {
          throw new Error("Invalid currency code (must be 3 characters).");
        }

        if (!reason) {
          throw new Error("Reason is required.");
        }

        // Find customer by email
        const searchCustomerQuery = `#graphql
          query findCustomerByEmail($query: String!) {
            customers(first: 1, query: $query) {
              edges {
                node {
                  id
                  displayName
                  email
                }
              }
            }
          }
        `;
        const searchRes = await admin.graphql(searchCustomerQuery, {
          variables: { query: `email:${email}` },
        });
        const searchData = await searchRes.json();
        const customerNode = searchData?.data?.customers?.edges?.[0]?.node;

        if (!customerNode) {
          throw new Error("Customer not found with this email.");
        }

        // Format expiration date if present
        let expiresAtIso: string | null = null;
        if (expirationDateStr) {
          const expDate = new Date(expirationDateStr);
          if (expDate.toString() === "Invalid Date") {
            throw new Error("Invalid expiration date format.");
          }
          if (expDate <= new Date()) {
            throw new Error("Expiration date must be in the future.");
          }
          expiresAtIso = expDate.toISOString();
        }

        // Issue adjustment
        await issueCreditAdjustment(admin, shop, {
          adjustmentType,
          ownerType: "Customer",
          id: customerNode.id,
          name: customerNode.displayName || "Unknown Customer",
          email: customerNode.email || email,
          amount: parsedAmount,
          currencyCode: currency.toUpperCase(),
          reason,
          expiresAt: expiresAtIso,
          notifyCustomer: notifyCustomers,
          createdBy,
        });

        success = true;
        successCount++;
      } catch (err: any) {
        errorMsg = err.message || "Unknown error occurred.";
        failedCount++;
      }

      results.push({
        email,
        status: success ? "Success" : "Failed",
        message: success ? "Successfully adjusted." : errorMsg,
      });

      // Update progress in database every record
      await db.bulkAdjustmentJob.update({
        where: { id: jobId },
        data: {
          processed: i + 1,
          successCount,
          failedCount,
        },
      });
    }

    // Build Results CSV content
    const csvHeader = "email,status,message\n";
    const csvRows = results
      .map((r) => `"${r.email}","${r.status}","${r.message.replace(/"/g, '""')}"`)
      .join("\n");
    const resultsCsvContent = csvHeader + csvRows;

    await db.bulkAdjustmentJob.update({
      where: { id: jobId },
      data: {
        status: "Completed",
        resultsCsv: resultsCsvContent,
      },
    });

    console.log(`[Bulk Job] Completed processing job ${jobId}. Success: ${successCount}, Failed: ${failedCount}`);
  } catch (globalErr: any) {
    console.error(`[Bulk Job Error] Critical failure in job ${jobId}:`, globalErr);
    await db.bulkAdjustmentJob.update({
      where: { id: jobId },
      data: {
        status: "Failed",
        errorMessage: globalErr.message || "Critical background processing error.",
      },
    });
  }
}
