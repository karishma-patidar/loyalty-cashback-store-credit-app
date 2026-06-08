import { useState, useEffect, useCallback } from "react";
import {
  useNavigate,
  useSearchParams,
  useRouteError,
  useLoaderData,
  useFetcher,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  getShopPrograms,
  setShopPrograms,
  deleteShopPrograms,
} from "../services/graphql.server";
import connectMongoDB, { getShopModel, migrateShopData } from "../db.mongodb.server";
import {
  IndexFilters,
  useSetIndexFiltersMode,
  IndexFiltersMode,
} from "@shopify/polaris";
import AdminModel from "../hooks/AdminModel";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const { shopId, programs } = await getShopPrograms(admin);

  // Connect to MongoDB to calculate exact issued store credit per program type
  await connectMongoDB();
  let currency = "INR";
  try {
    await migrateShopData(session.shop);
    const ShopModel = getShopModel(session.shop);
    const docs = ShopModel ? await ShopModel.find({}) : [];

    // Process each program to assign its dynamic issued amount
    for (const prog of programs) {
      let totalIssued = 0;
      const isCustom = prog.programType === "custom";

      for (const doc of docs) {
        if (doc.events && Array.isArray(doc.events)) {
          for (const ev of doc.events) {
            if (ev.status === "Completed") {
              if (ev.currency) currency = ev.currency;
              const evIsCustom = ev.programType === "Custom Program";
              if (isCustom && evIsCustom) {
                totalIssued += Number(ev.issuedAmount || 0);
              } else if (!isCustom && !evIsCustom) {
                totalIssued += Number(ev.issuedAmount || 0);
              }
            }
          }
        }
      }

      prog.issued = totalIssued.toFixed(2);
    }
  } catch (err) {
    console.error("❌ Error calculating program issued amounts:", err);
  }

  return { programs, shopId };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const payload = await request.json();
  const { actionType, id } = payload;

  try {
    const { shopId, programs } = await getShopPrograms(admin);

    if (actionType === "delete") {
      const filteredPrograms = programs.filter((p) => p.id !== id);

      if (filteredPrograms.length === 0) {
        await deleteShopPrograms(admin, shopId);
      } else {
        await setShopPrograms(admin, shopId, filteredPrograms);
      }
      return Response.json({ success: true, actionType: "delete", id });
    }

    if (actionType === "toggleStatus") {
      let newStatus = "";
      const updatedPrograms = programs.map((p) => {
        if (p.id === id) {
          newStatus = p.status === "Active" ? "Paused" : "Active";
          return { ...p, status: newStatus };
        }
        return p;
      });

      await setShopPrograms(admin, shopId, updatedPrograms);
      return Response.json({
        success: true,
        actionType: "toggleStatus",
        id,
        status: newStatus,
      });
    }

    return Response.json({ success: false, error: "Invalid action" });
  } catch (error) {
    return Response.json({
      success: false,
      actionType,
      id,
      error: error.message,
    });
  }
};

export default function Programs() {
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const loaderData = useLoaderData();
  const [programs, setPrograms] = useState(loaderData?.programs || []);
  const [, setShopId] = useState(loaderData?.shopId || null);

  const fetcher = useFetcher();

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.success) {
        if (fetcher.data.actionType === "delete") {
          setPrograms((prev) => prev.filter((p) => p.id !== fetcher.data.id));
          shopify.toast.show("Program deleted");
          setProgramToDelete(null);
        } else if (fetcher.data.actionType === "toggleStatus") {
          shopify.toast.show(`Program ${fetcher.data.status}`);
        }
      } else {
        shopify.toast.show(fetcher.data.error || "Action failed", {
          isError: true,
        });
        if (fetcher.data.actionType === "delete") {
          setProgramToDelete(null);
        }
        if (fetcher.data.actionType === "toggleStatus" && fetcher.data.id) {
          setPrograms((prev) =>
            prev.map((p) => {
              if (p.id === fetcher.data.id) {
                const revertedStatus =
                  p.status === "Active" ? "Paused" : "Active";
                return { ...p, status: revertedStatus };
              }
              return p;
            }),
          );
        }
      }
    }
  }, [fetcher.state, fetcher.data, shopify]);

  useEffect(() => {
    if (loaderData) {
      setPrograms(loaderData.programs);
      setShopId(loaderData.shopId);
    }
  }, [loaderData]);

  const [activeTab, setActiveTab] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const { mode, setMode } = useSetIndexFiltersMode();
  const [programToDelete, setProgramToDelete] = useState(null);

  const handleFiltersCancel = useCallback(() => {
    setMode(IndexFiltersMode.Default);
  }, [setMode]);

  const tabs = ["All", "Active", "Cashback", "Custom Program"].map((item, index) => ({
    content: item,
    index,
    onAction: () => { },
    id: `${item}-${index}`,
  }));

  const activeTabIdx = ["All", "Active", "Cashback", "Custom Program"].indexOf(activeTab);

  const filteredPrograms = programs.filter((prog) => {
    const matchesSearch =
      (prog.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (prog.programId || (prog.id ? `PROG-${prog.id.slice(-3)}` : ""))
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    if (activeTab === "All") return matchesSearch;
    if (activeTab === "Active")
      return matchesSearch && prog.status === "Active";
    if (activeTab === "Cashback")
      return matchesSearch && prog.programType !== "custom";
    if (activeTab === "Custom Program")
      return matchesSearch && prog.programType === "custom";

    return matchesSearch;
  });

  useEffect(() => {
    if (searchParams.get("toast") === "saved") {
      shopify.toast.show("Program saved");
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("toast");
      setSearchParams(newParams, { replace: true });
    } else if (searchParams.get("toast") === "deleted") {
      shopify.toast.show("Program deleted");
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("toast");
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams, shopify]);

  const deleteProgram = useCallback(
    (id) => {
      setProgramToDelete(id);
    },
    [],
  );

  const confirmDelete = useCallback(() => {
    if (programToDelete) {
      fetcher.submit(
        { actionType: "delete", id: programToDelete },
        { method: "POST", encType: "application/json" },
      );
    }
  }, [fetcher, programToDelete]);
  const toggleStatus = useCallback(
    (id) => {
      const prog = programs.find((p) => p.id === id);
      if (!prog) return;

      const newStatus = prog.status === "Active" ? "Paused" : "Active";
      setPrograms((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p)),
      );

      fetcher.submit(
        { actionType: "toggleStatus", id },
        { method: "POST", encType: "application/json" },
      );
    },
    [programs, fetcher],
  );

  if (programs.length === 0) {
    return (
      <s-page>
        <s-section accessibilityLabel="Empty state with intents">
          <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
            <s-box maxInlineSize="200px" maxBlockSize="200px">
              <s-image
                aspectRatio="1/0.5"
                src="https://cdn.shopify.com/static/images/polaris/patterns/callout.png"
                alt="Illustration showing product creation"
              />
            </s-box>
            <s-grid justifyItems="center" maxInlineSize="450px" gap="base">
              <s-stack alignItems="center" gap="base">
                <s-heading>Create your first Cashback Program</s-heading>
                <s-paragraph style={{ textAlign: "center", margin: "0 auto" }}>
                  Boost customer loyalty with store credit rewards on purchases. Launch customized campaigns, manage expiration settings, and increase repeat orders while growing your brand.
                </s-paragraph>
              </s-stack>
              <s-button-group>
                <s-button
                  slot="secondary-actions"
                  onClick={() => navigate("/app")}
                >
                  Dashboard
                </s-button>
                <s-button
                  slot="primary-action"
                  onClick={() => navigate("/app/choose-template")}
                >
                  Create program
                </s-button>
              </s-button-group>
            </s-grid>
          </s-grid>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page>
      <s-section>
        <s-stack gap="base">
          {/* Header Row */}
          <s-stack direction="inline" justifyContent="space-between">
            <s-heading variant="headingLg" >
              Programs
            </s-heading>
            <s-stack direction="inline" gap="base">
              <s-button
                variant="secondary"
                onClick={() => navigate("/app/settings")}
              >
                Settings
              </s-button>
              <s-button
                variant="primary"
                onClick={() => navigate("/app/choose-template")}
                className="bg-black text-white shadow-sm"
              >
                Create program
              </s-button>
            </s-stack>
          </s-stack>

          {/* Table Card */}
          <s-box
            background="surface"
            borderWidth="base"
            borderRadius="base"
          >
            {/* Tabs & Search Row */}
            <IndexFilters
              queryValue={searchQuery}
              queryPlaceholder="Search by program name"
              onQueryChange={setSearchQuery}
              onQueryClear={() => setSearchQuery("")}
              tabs={tabs}
              selected={activeTabIdx}
              onSelect={(index) => setActiveTab(tabs[index].content)}
              filters={[]}
              appliedFilters={[]}
              onClearAll={() => { }}
              cancelAction={{
                onAction: handleFiltersCancel,
              }}
              mode={mode}
              setMode={setMode}
              canCreateNewView={false}
            />

            {filteredPrograms.length === 0 ? (
              <div style={{ background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '80px 20px' }}>
                <div style={{ opacity: 0.4, color: 'var(--p-color-icon-secondary)', marginBottom: '16px' }}>
                  <svg
                    viewBox="0 0 24 24"
                    width="48"
                    height="48"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </div>
                <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--p-color-text)', margin: '0 0 8px 0' }}>
                  No Items found
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--p-color-text-secondary)', margin: 0 }}>
                  Try changing the filters or search term
                </p>
              </div>
            ) : (
              <s-section >
                <s-table>
                  <s-table-header-row >
                    <s-table-header >
                      Program Name
                    </s-table-header>
                    <s-table-header >
                      Program ID
                    </s-table-header>
                    <s-table-header>
                      Issued amount
                    </s-table-header>
                    <s-table-header >
                      Remaining budget
                    </s-table-header>
                    <s-table-header >
                      Status
                    </s-table-header>
                    <s-table-header >
                      Action
                    </s-table-header>
                  </s-table-header-row>

                  <s-table-body>
                    {filteredPrograms.map((prog) => (
                      <s-table-row
                        key={prog.id}

                      >
                        <s-table-cell className="py-4">
                          <s-text
                            variant="bold"

                          >
                            {prog.name}
                          </s-text>
                        </s-table-cell>
                        <s-table-cell className="py-4">
                          <s-stack direction="inline" gap="tight" alignment="center">
                            <s-text color="subdued" className="text-[12px]">
                              {(() => {
                                const displayId = prog.programId || `PROG-${prog.id.slice(-3)}`;
                                return displayId.length > 10 ? displayId.slice(0, 10) + "..." : displayId;
                              })()}
                            </s-text>
                            <s-tooltip id={`copy-tooltip-${prog.id}`}>Copy Program Id</s-tooltip>
                            <s-button
                              interestFor={`copy-tooltip-${prog.id}`}
                              variant="tertiary"
                              icon="clipboard"
                              onClick={() => {
                                navigator.clipboard.writeText(prog.programId || `PROG-${prog.id.slice(-3)}`);
                                shopify.toast.show("Program ID copied");
                              }}

                            />
                          </s-stack>
                        </s-table-cell>
                        <s-table-cell className="py-4 text-right">
                          <s-text color="subdued" className="text-[12px]">
                            {prog.issued || "0.00"}
                          </s-text>
                        </s-table-cell>
                        <s-table-cell className="py-4 text-right">
                          <s-text color="subdued" className="text-[12px]">
                            {prog.budget || "Unlimited"}
                          </s-text>
                        </s-table-cell>
                        <s-table-cell className="py-4">
                          <s-badge
                            tone={
                              prog.status === "Active" ? "success" : "subdued"
                            }
                          >
                            {prog.status}
                          </s-badge>
                        </s-table-cell>
                        <s-table-cell className="py-4">
                          <s-stack
                            direction="inline"
                            gap="tight"
                            alignment="center"
                            className="justify-center"
                          >
                            <s-tooltip id={`status-tooltip-${prog.id}`}>
                              {prog.status === "Active" ? "Deactivate" : "Activate"}
                            </s-tooltip>
                            <s-tooltip id={`edit-tooltip-${prog.id}`}>Edit</s-tooltip>
                            <s-tooltip id={`delete-tooltip-${prog.id}`}>Delete</s-tooltip>

                            <s-button
                              interestFor={`status-tooltip-${prog.id}`}
                              variant="tertiary"
                              icon={
                                prog.status === "Active"
                                  ? "pause-circle"
                                  : "play-circle"
                              }
                              onClick={() => toggleStatus(prog.id)}
                              className="p-1"
                            />
                            <s-button
                              interestFor={`edit-tooltip-${prog.id}`}
                              variant="tertiary"
                              icon="edit"
                              onClick={() => {
                                console.log("Navigating to edit:", prog.id, "Type:", prog.programType);
                                if (prog.programType === "custom") {
                                  navigate(`/app/flow-temapate?programId=${prog.id}`);
                                } else {
                                  navigate(`/app/programs_new?id=${prog.id}`);
                                }
                              }}
                              className="p-1"
                            />
                            <s-button
                              interestFor={`delete-tooltip-${prog.id}`}
                              variant="tertiary"
                              icon="delete"
                              onClick={() => deleteProgram(prog.id)}
                              className="p-1"
                            />
                          </s-stack>
                        </s-table-cell>
                      </s-table-row>
                    ))}
                  </s-table-body>
                </s-table>
              </s-section>
            )}

          </s-box>
        </s-stack>
      </s-section>

      <AdminModel
        loading={fetcher.state !== "idle"}
        modalOpen={!!programToDelete}
        setModalOpen={(open) => {
          if (!open) setProgramToDelete(null);
        }}
        title="Delete Flow Program"
        buttonLabel="Delete program"
        tone="critical"
        handleSave={confirmDelete}
        modelContent={
          <s-text>
            This action cannot be undone. Please confirm that you want to delete this program permanently.
          </s-text>
        }
      />
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
