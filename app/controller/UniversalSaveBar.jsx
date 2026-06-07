import { SaveBar } from "@shopify/app-bridge-react";
import React from "react";
import { useLocation, useNavigate } from "react-router";

export const backActionButton = (save, url) => {
    const navigate = useNavigate();
    const location = useLocation?.();
    const fromRoute = location?.state?.fromRoute;
    const handleAction = () => {
        if (!save) {
            navigate(fromRoute || url, { replace: true });
        } else {
            window.open("shopify://admin/apps", "_self");
        }
    };

    return { content: "", onAction: handleAction };
};


export const CurrentDate = () => {
    let date_time = new Date();
    let date = ("0" + date_time.getDate()).slice(-2);
    let month = ("0" + (date_time.getMonth() + 1)).slice(-2);
    let year = date_time.getFullYear();
    return (
        date +
        "-" +
        month +
        "-" +
        year
    );
};


function UniversalSaveBar(props) {
    const { open, loading, unsave, save } = props;
    return (
        <>
            <SaveBar
                id="my-save-bar"
                open={open}
            >
                <button
                    variant="primary"
                    loading={loading ? "" : null}
                    onClick={save}
                ></button>
                <button disabled={loading ? true : false} onClick={unsave}></button>
            </SaveBar>
        </>
    );
}

export default UniversalSaveBar;
