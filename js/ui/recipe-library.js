/**
 * Recipe Library UI Module
 * Provides modal interface for browsing, loading, and deleting saved recipes
 */

import { showModal, hideModal } from './components.js';

/**
 * Display the recipe library modal
 * @param {Object} storage - Storage instance with listRecipes, loadRecipe, deleteRecipe methods
 * @param {Object} callbacks - Callback functions for user actions
 * @param {Function} callbacks.onLoad - Called with recipe name when user clicks Load
 * @param {Function} callbacks.onDelete - Called with recipe name when user clicks Delete
 */
export async function showRecipeLibrary(storage, callbacks = {}) {
    const { onLoad, onDelete } = callbacks;

    // Get list of saved recipes from storage
    const recipes = await storage.listRecipes();

    // Build modal content
    const content = document.createElement('div');

    // Header
    const header = document.createElement('h3');
    header.textContent = 'Recipe Library';
    content.appendChild(header);

    if (recipes.length === 0) {
        // Empty state message
        const emptyMsg = document.createElement('p');
        emptyMsg.textContent = 'No saved recipes yet. Save a recipe to see it here.';
        emptyMsg.style.color = 'var(--mid-grey)';
        content.appendChild(emptyMsg);
    } else {
        // Recipe list table
        const table = document.createElement('table');
        table.className = 'recipe-library-list';

        // Header row
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        ['Name', 'Saved', 'Actions'].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body rows
        const tbody = document.createElement('tbody');
        recipes.forEach(recipe => {
            const row = document.createElement('tr');

            // Name column
            const nameCell = document.createElement('td');
            nameCell.textContent = recipe.name;
            row.appendChild(nameCell);

            // Saved date column
            const dateCell = document.createElement('td');
            dateCell.textContent = recipe.updatedAt
                ? new Date(recipe.updatedAt).toLocaleDateString()
                : '';
            row.appendChild(dateCell);

            // Actions column
            const actionsCell = document.createElement('td');

            // Load button
            const loadBtn = document.createElement('button');
            loadBtn.textContent = 'Load';
            loadBtn.title = 'Load this recipe';
            loadBtn.onclick = () => {
                hideModal();
                if (onLoad) {
                    onLoad(recipe.name);
                }
            };
            actionsCell.appendChild(loadBtn);

            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.title = 'Delete this recipe';
            deleteBtn.style.marginLeft = '4px';
            deleteBtn.onclick = async () => {
                if (confirm(`Delete "${recipe.name}"? This cannot be undone.`)) {
                    if (onDelete) {
                        await onDelete(recipe.name);
                    }
                    hideModal();
                }
            };
            actionsCell.appendChild(deleteBtn);

            row.appendChild(actionsCell);
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        content.appendChild(table);
    }

    // Create close button for modal footer
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.width = '100%';
    closeBtn.onclick = hideModal;

    const buttons = document.createElement('div');
    buttons.appendChild(closeBtn);

    // Show the modal
    showModal(content, buttons);
}
