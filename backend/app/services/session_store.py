from app.services.cosmos_services import get_container


def save_session(state):
    container = get_container()
    if not container:
        return

    session_id = state.get("session_id", state.get("id"))
    if not session_id:
        return

    # To preserve fields like resume_data, progress_scores, evaluation
    existing = load_session(session_id)
    
    if existing:
        item = existing[-1] if isinstance(existing, list) else existing
        for k, v in state.items():
            item[k] = v
        item["id"] = session_id
    else:
        item = dict(state)
        item["id"] = session_id

    try:
        container.upsert_item(item)
    except Exception as e:
        print(f"Error saving session: {e}")


def load_session(session_id):
    container = get_container()
    if not container:
        return []

    query = "SELECT * FROM c WHERE c.session_id=@session_id"

    try:
        items = list(container.query_items(
            query=query,
            parameters=[{"name": "@session_id", "value": session_id}],
            enable_cross_partition_query=True
        ))
        return items
    except Exception as e:
        print(f"Error loading session: {e}")
        return []