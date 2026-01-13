/**
 * UI Components Module
 * Tab system, modal dialogs, and status bar messaging
 */

// Dependencies injected from app.js
let onTabSwitch = null;

/**
 * Initialize the UI components module with dependencies
 * @param {object} deps - Dependencies from the main app
 * @param {function} deps.onTabSwitch - Callback when a tab is switched (receives tabId)
 */
export function initUIComponents(deps) {
    if (deps.onTabSwitch) onTabSwitch = deps.onTabSwitch;
}

// ============================================================
// Tab System
// ============================================================

/**
 * Handle tab click events
 * Deactivates all tabs in the same group and activates the clicked tab
 * @param {Event} event - Click event from tab button
 */
function tabHandler(event) {
    const currentTab = event.currentTarget;
    const tabGroup = currentTab.dataset.tabgrp;
    const tabId = currentTab.dataset.tabid;

    // Deactivate all tab links in the same group
    Array.from(document.getElementsByClassName("tablink")).forEach(function (tablink) {
        if (tablink.dataset.tabgrp === tabGroup)
            tablink.className = tablink.className.replace(" active", "");
    });

    // Hide all tab content in the same group
    Array.from(document.getElementsByClassName("tabcontent")).forEach(function (tabcontent) {
        if (tabcontent.dataset.tabgrp === tabGroup)
            tabcontent.style.display = "none";
    });

    // Show the selected tab content and mark tab as active
    document.getElementById(tabId).style.display = "block";
    currentTab.className += " active";

    // Notify the app about the tab switch
    if (onTabSwitch) {
        onTabSwitch(tabId);
    }
}

/**
 * Initialize tab handlers for all tab buttons
 * Call this after DOM is loaded
 */
export function initTabs() {
    Array.from(document.getElementsByClassName("tablink")).forEach(tablink => {
        tablink.onclick = tabHandler;
    });
}

// ============================================================
// Modal Dialog System
// ============================================================

/**
 * Display a modal dialog with content and optional custom buttons
 * @param {string|HTMLElement} content - HTML string or DOM element to display
 * @param {HTMLElement|null} buttons - Optional custom buttons container
 */
export function showModal(content, buttons = null) {
    console.assert(content != null && ["string", "object"].includes(typeof content));

    var modal = document.getElementById("Modal");
    modal.style.display = "block";

    var buttonEl = document.getElementById("ModalButtons");
    buttonEl.innerHTML = "";
    if (buttons == null) {
        var closeButton = document.createElement("button");
        closeButton.innerText = "Close";
        closeButton.style = "width: 100%;";
        closeButton.onclick = hideModal;
        buttonEl.appendChild(closeButton);
        window.onclick = function (event) {
            if (event.target == modal)
                hideModal();
        };
    } else {
        buttonEl.appendChild(buttons);
    }

    var contentEl = document.getElementById("ModalContent");

    switch (typeof content) {
        case "string":
            contentEl.innerHTML = content;
            break;
        case "object":
            contentEl.innerHTML = ""; // remove current content
            contentEl.appendChild(content);
            break;
    }
}

/**
 * Hide the modal dialog
 */
export function hideModal() {
    document.getElementById("Modal").style.display = "none";
    window.onclick = null;
}

// ============================================================
// Status Bar Messaging
// ============================================================

/**
 * Display an info message in the status bar
 * @param {string} message - Message to display
 * @param {number} timeout - Seconds before message clears (default 3)
 */
export function Info(message, timeout = 3) {
    SetStatusBarMessage("\uD83D\uDCA1 " + message, timeout);
}

/**
 * Display a warning message in the status bar
 * @param {string} message - Message to display
 * @param {number} timeout - Seconds before message clears (default 6)
 */
export function Warning(message, timeout = 6) {
    SetStatusBarMessage("\u26A0\uFE0F " + message, timeout, "var(--contrast)");
}

/**
 * Display an error message in the status bar
 * @param {string} message - Message to display
 * @param {number} timeout - Seconds before message clears (default 10)
 */
export function ErrorMsg(message, timeout = 10) {
    SetStatusBarMessage("\u26D4 " + message, timeout, "red");
}

/**
 * Display a message in the status bar with optional styling
 * @param {string} message - Message to display
 * @param {number} timeout - Seconds before message clears (0 = permanent)
 * @param {string} color - Optional background color
 */
export function SetStatusBarMessage(message, timeout = 5, color = '') {
    var statusbar = document.getElementById("statusBar");
    statusbar.style = color == "" ? "" : ("background-color: " + color + ";");
    statusbar.innerText = message;
    if (timeout > 0) {
        if (SetStatusBarMessage.timeOutID !== undefined && SetStatusBarMessage.timeOutID !== 0)
            clearTimeout(SetStatusBarMessage.timeOutID);
        SetStatusBarMessage.timeOutID = setTimeout(() => {
            SetStatusBarMessage.timeOutID = 0;
            statusbar.innerText = " ";
            statusbar.style = "";
        }, timeout * 1000);
    }
}

// ============================================================
// CSS Helpers
// ============================================================

/**
 * Get a CSS property value for an element
 * @param {HTMLElement} element - DOM element to query
 * @param {string} property - CSS property name
 * @returns {string} The computed property value
 */
export function getCSS(element, property) {
    return getComputedStyle(element).getPropertyValue(property);
}
