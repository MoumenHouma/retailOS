use serde::Deserialize;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter};

#[derive(Deserialize)]
pub struct MenuItemPayload {
    pub id: String,
    pub label: String,
}

#[derive(Deserialize)]
pub struct MenuGroupPayload {
    pub label: Option<String>,
    pub items: Vec<MenuItemPayload>,
}

// Rust does no translation and no desktopHidden filtering of its own — the
// frontend (src/config/nav.ts + next-intl) is the single source of truth and
// hands over an already-resolved, already-translated structure. This command
// only ever builds whatever it's given. Item `id` is the route href (e.g.
// "/pos"); on_menu_event in main.rs re-emits it to the frontend so a click
// becomes a client-side SPA navigation instead of a full page reload.
#[tauri::command]
pub fn set_app_menu(app: AppHandle, groups: Vec<MenuGroupPayload>) -> tauri::Result<()> {
    let mut builder = MenuBuilder::new(&app);
    for group in groups {
        match group.label {
            Some(label) => {
                let mut sub = SubmenuBuilder::new(&app, label);
                for item in group.items {
                    sub = sub.item(&MenuItemBuilder::with_id(item.id, item.label).build(&app)?);
                }
                builder = builder.item(&sub.build()?);
            }
            None => {
                for item in group.items {
                    builder = builder.item(&MenuItemBuilder::with_id(item.id, item.label).build(&app)?);
                }
            }
        }
    }
    let menu = builder.build()?;
    app.set_menu(menu)?;
    Ok(())
}

// Re-emitted from main.rs's .on_menu_event(); kept here only as the payload
// shape both sides agree on, avoiding a magic string literal in two places.
pub const MENU_NAVIGATE_EVENT: &str = "menu-navigate";

pub fn emit_navigate(app: &AppHandle, route: &str) {
    let _ = app.emit(MENU_NAVIGATE_EVENT, route);
}
