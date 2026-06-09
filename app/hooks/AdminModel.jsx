import { Modal, TitleBar } from "@shopify/app-bridge-react";
import { Box } from "@shopify/polaris";

function AdminModel(props) {
    const { modalOpen, setModalOpen, title, buttonLabel, modelContent, loading, handleSave, tone, size, padding = "300" } = props;
    console.log(modalOpen, "modalOpen")
    return (
        <>
            <Modal
                variant={size ? size : "base"}
                onHide={() => setModalOpen(false)}
                open={modalOpen}
            >
                <Box padding={padding}>{modelContent}</Box>
                <TitleBar title={title}>
                    {buttonLabel ? (
                        <>
                            <button
                                loading={loading ? "" : null}
                                variant="primary"
                                tone={tone ? tone : "default"}
                                // tone='critical'
                                onClick={handleSave}
                            >
                                {buttonLabel || "Save"}
                            </button>
                            <button onClick={() => setModalOpen(false)}>Cancel</button>
                        </>
                    ) : (
                        ""
                    )}
                </TitleBar>
            </Modal>
        </>
    );
}

export default AdminModel;
