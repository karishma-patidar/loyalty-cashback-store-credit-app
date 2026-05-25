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
import connectMongoDB, { getShopModel } from "../db.mongodb.server";
import {
  IndexFilters,
  useSetIndexFiltersMode,
  IndexFiltersMode,
} from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const { shopId, programs } = await getShopPrograms(admin);

  // Connect to MongoDB to calculate exact issued store credit per program type
  await connectMongoDB();
  let currency = "INR";
  try {
    const ShopModel = getShopModel(session.shop);
    if (ShopModel) {
      await ShopModel.updateMany(
        { "events.type": "Custom Program" },
        { $set: { "events.$[elem].type": "Cashback" } },
        { arrayFilters: [{ "elem.type": "Custom Program" }] }
      );
    }
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
              const evIsCustom = ev.type === "Custom Program";
              if (isCustom && evIsCustom) {
                totalIssued += Number(ev.amount || 0);
              } else if (!isCustom && !evIsCustom) {
                totalIssued += Number(ev.amount || 0);
              }
            }
          }
        }
      }

      prog.issued = `${totalIssued.toFixed(2)} ${currency}`;
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
        } else if (fetcher.data.actionType === "toggleStatus") {
          shopify.toast.show(`Program ${fetcher.data.status}`);
        }
      } else {
        shopify.toast.show(fetcher.data.error || "Action failed", {
          isError: true,
        });
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
      if (!confirm("Are you sure you want to delete this program?")) return;

      fetcher.submit(
        { actionType: "delete", id },
        { method: "POST", encType: "application/json" },
      );
    },
    [fetcher],
  );

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
        <s-box className="max-w-[1100px] mx-auto px-4 py-16 flex justify-center">
          <s-box className="shadow-sm border border-gray-200 p-10 flex flex-col items-center text-center max-w-[600px] w-full">
            <s-heading
              variant="headingLg"
              className="font-bold text-[22px] mb-3 text-gray-800"
            >
              Create your first Cashback Program
            </s-heading>

            <s-paragraph
              color="subdued"
              className="text-[14px] leading-relaxed text-gray-500 mb-8 max-w-[480px]"
            >
              Encourage customers to buy more by rewarding them with store
              credit on their orders or items. Schedule campaigns, set
              expiration limits, and scale your brand loyalty effortlessly.
            </s-paragraph>

            <s-stack
              direction="inline"
              gap="base"
              alignment="center"
              className="justify-center"
            >
              <s-button
                variant="secondary"
                className="bg-white border border-gray-200 shadow-sm"
              >
                Settings
              </s-button>
              <s-button
                variant="primary"
                onClick={() => navigate("/app/programs_new")}
                className="bg-black text-white shadow-sm"
              >
                Create program
              </s-button>
            </s-stack>
          </s-box>
        </s-box>
      </s-page>
    );
  }

  return (
    <s-box className="min-h-screen">
      <s-page>
        <s-stack gap="base">
          {/* Header Row */}
          <s-stack direction="inline" justifyContent="space-between">
            <s-heading variant="headingLg" className="text-[28px] font-bold">
              Programs
            </s-heading>
            <s-stack direction="inline" gap="base">
              <s-button
                variant="secondary"
                onClick={() => navigate("/app/promotion_widgets")}
              >
                Settings
              </s-button>
              <s-button
                variant="primary"
                onClick={() => navigate("/app/programs_new")}
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
            className="shadow-sm border-gray-200 overflow-hidden"
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
              <s-section padding="none">
                <s-table>
                  <s-table-header-row className="bg-gray-50/50">
                    <s-table-header className="text-[11px] font-bold text-gray-400 uppercase tracking-tight">
                      Program Name
                    </s-table-header>
                    <s-table-header className="text-[11px] font-bold text-gray-400 uppercase tracking-tight">
                      Program ID
                    </s-table-header>
                    <s-table-header className="text-[11px] font-bold text-gray-400 uppercase tracking-tight text-right">
                      Issued amount
                    </s-table-header>
                    <s-table-header className="text-[11px] font-bold text-gray-400 uppercase tracking-tight text-right">
                      Remaining budget
                    </s-table-header>
                    <s-table-header className="text-[11px] font-bold text-gray-400 uppercase tracking-tight">
                      Status
                    </s-table-header>
                    <s-table-header className="text-[11px] font-bold text-gray-400 uppercase tracking-tight text-center">
                      Action
                    </s-table-header>
                  </s-table-header-row>

                  <s-table-body>
                    {filteredPrograms.map((prog) => (
                      <s-table-row
                        key={prog.id}
                        className="hover:bg-gray-50/20 transition-colors"
                      >
                        <s-table-cell className="py-4">
                          <s-text
                            variant="bold"
                            className="text-[13px] text-gray-800"
                          >
                            {prog.name}
                          </s-text>
                        </s-table-cell>
                        <s-table-cell className="py-4">
                          <s-text color="subdued" className="text-[12px]">
                            {prog.programId || `PROG-${prog.id.slice(-3)}`}
                          </s-text>
                        </s-table-cell>
                        <s-table-cell className="py-4 text-right">
                          <s-text color="subdued" className="text-[12px]">
                            {prog.issued || "0 INR"}
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
                            <s-button
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
                              variant="tertiary"
                              icon="edit"
                              onClick={() => {
                                console.log("Navigating to edit:", prog.id);
                                navigate(`/app/programs_new?id=${prog.id}`);
                              }}
                              className="p-1"
                            />
                            <s-button
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

            {/* Footer Pagination */}
            <s-box
              padding="3"
              className="flex justify-center items-center border-t border-gray-100 bg-gray-50/20 gap-2"
            >
              <s-button
                variant="secondary"
                icon="chevron-left"
                disabled
                className="min-w-0"
              />
              <s-button
                variant="secondary"
                icon="chevron-right"
                disabled
                className="min-w-0"
              />
            </s-box>
          </s-box>
        </s-stack>
      </s-page>
    </s-box>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
