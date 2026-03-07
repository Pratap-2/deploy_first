from app.services.cosmos_services import get_container


def save_session(state):
    container = get_container()
    if not container:
        return

    item = {
        "id": state["session_id"],
        "session_id": state["session_id"],
        "problem_statement": state["problem_statement"],
        "current_code": state["current_code"],
        "compiler_output": state["compiler_output"],
        "analysis": state.get("code_analysis", ""),
        "messages": state.get("messages", []),
        "ping_count": state.get("ping_count", 0),
        "start_time": state.get("start_time", None),
        "last_activity": state.get("last_activity", None),
        "hint_level": state.get("hint_level", 0),
    }

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