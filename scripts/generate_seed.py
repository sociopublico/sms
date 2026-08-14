#!/usr/bin/env python3
"""Generate supabase/seed.sql from the spreadsheet snapshot."""
from __future__ import annotations

import csv
import re
import uuid
import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime
from pathlib import Path

NS = uuid.NAMESPACE_URL
SRC = Path("/home/agus/dev/sociopublico/spreadsheet-script-ale")
OUT = Path("/home/agus/dev/sociopublico/gestion/supabase/seed.sql")
XLSX = SRC / "Proyectos en curso _ - new.xlsx"

TASK_COLORS = {
    "Discovery": "#6366f1",
    "Diseño web": "#0ea5e9",
    "Desarrollo React": "#16a34a",
    "Desarrollo Wordpress": "#65a30d",
    "Diseño gráfico": "#d97706",
    "Contenido": "#7c3aed",
    "Carga de contenido": "#6d28d9",
    "Edición video": "#db2777",
    "Animación": "#e11d48",
    "Estrategia": "#0f766e",
    "Evaluación": "#0369a1",
    "ETL": "#1d4ed8",
    "QA": "#b45309",
    "Garantía": "#92400e",
    "PM": "#4338ca",
    "Producción": "#be185d",
    "Mantenimiento React": "#15803d",
    "Mantenimiento Wordpress": "#4d7c0f",
    "Investigación": "#6b21a8",
    "Contenido + diseño": "#a21caf",
    "Data + diseño": "#1e40af",
    "Data": "#1e3a8a",
    "On hold": "#64748b",
    "Cierre": "#334155",
}

ALWAYS_ON = {"PM", "Supervisión"}
IMPORT_STATUSES = {"en curso", "mantenimiento", "pausado"}


def uid(*parts: str) -> str:
    return str(uuid.uuid5(NS, "gestion:" + ":".join(parts)))


def sql_str(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def parse_date(value: str) -> str | None:
    value = (value or "").strip()
    if not value:
        return None
    for fmt in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def slug(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")[:80] or "sin-nombre"


def split_names(cell: str) -> list[str]:
    if not cell:
        return []
    return [p.strip() for p in re.split(r"\s*,\s*", cell) if p.strip()]


def xlsx_people() -> dict[str, list[str]]:
    people: dict[str, list[str]] = {}
    with zipfile.ZipFile(XLSX) as z:
        ss = ET.fromstring(z.read("xl/sharedStrings.xml"))
        shared = []
        for si in ss.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si"):
            texts = [t.text or "" for t in si.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")]
            shared.append("".join(texts))
        xml = ET.fromstring(z.read("xl/worksheets/sheet8.xml"))
        sheet_data = xml.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheetData")
        rows = {}
        for row in sheet_data.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row"):
            ridx = int(row.attrib["r"])
            cells = {}
            for c in row.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c"):
                ref = c.attrib["r"]
                col = re.match(r"[A-Z]+", ref).group(0)
                t = c.attrib.get("t")
                v = c.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
                val = None
                if t == "s" and v is not None:
                    val = shared[int(v.text)]
                elif v is not None:
                    val = v.text
                if val:
                    cells[col] = val
            if cells:
                rows[ridx] = cells
        for r, cells in rows.items():
            if r == 1:
                continue
            name = (cells.get("A") or "").strip()
            roles = split_names(cells.get("B") or "")
            if name:
                people[name] = roles
    return people


def main() -> None:
    people = xlsx_people()
    roles: dict[str, None] = {}
    for role_list in people.values():
        for role in role_list:
            roles[role] = None

    task_roles: list[tuple[str, str]] = []
    tasks: dict[str, None] = {}
    with (SRC / "Proyectos en curso - Tareas x rol.csv").open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            task = (row.get("Tarea") or "").strip()
            role = (row.get("Rol") or "").strip()
            if not task:
                continue
            tasks[task] = None
            if role:
                roles[role] = None
                task_roles.append((task, role))

    timelines_path = SRC / "Proyectos en curso _ - 🟢 Timelines proyectos.csv"
    pxp_path = SRC / "Proyectos en curso _ - 🟢 Personas x proyecto.csv"

    clients: dict[str, str] = {}
    projects: dict[str, dict] = {}
    workstreams: list[dict] = []

    with timelines_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        week_cols = [h for h in reader.fieldnames if parse_date(h)]
        for row in reader:
            estado = (row.get("Estado") or "").strip()
            if estado.lower() not in IMPORT_STATUSES:
                continue
            cliente = (row.get("Cliente") or "").strip()
            ws_name = (row.get("Workstream") or "").strip()
            if not cliente or not ws_name:
                continue
            clients.setdefault(cliente, uid("client", cliente))
            code = (row.get("ID") or "").strip()
            ficha = (row.get("Ficha") or "").strip() or None
            if not code:
                code = f"SIN-FICHA-{slug(cliente)}-{slug(ws_name)}"
            if code not in projects:
                status = {
                    "en curso": "en_curso",
                    "pausado": "pausado",
                    "mantenimiento": "mantenimiento",
                }[estado.lower()]
                projects[code] = {
                    "id": uid("project", code),
                    "client": cliente,
                    "ficha": ficha,
                    "status": status,
                    "kind": "internal" if cliente.lower() in {"socio", "sociopúblico", "sociopublico"} else "client",
                }
            ws_status = {
                "en curso": "en_curso",
                "pausado": "pausado",
                "mantenimiento": "mantenimiento",
            }[estado.lower()]
            ws_id = uid("ws", code, ws_name)
            weeks = []
            for col in week_cols:
                raw = (row.get(col) or "").strip()
                if not raw:
                    continue
                week = parse_date(col)
                cell_tasks = [p.strip() for p in re.split(r"\s*,\s*", raw) if p.strip()]
                for tname in cell_tasks:
                    tasks.setdefault(tname, None)
                weeks.append((week, cell_tasks))
            workstreams.append(
                {
                    "id": ws_id,
                    "code": code,
                    "name": ws_name,
                    "status": ws_status,
                    "cliente": cliente,
                    "weeks": weeks,
                }
            )

    assignments: list[tuple[str, str, str]] = []
    with pxp_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        role_cols = [h for h in reader.fieldnames if h not in ("Cliente", "Workstream")]
        for row in reader:
            cliente = (row.get("Cliente") or "").strip()
            ws_name = (row.get("Workstream") or "").strip()
            match = next((w for w in workstreams if w["cliente"] == cliente and w["name"] == ws_name), None)
            if not match:
                continue
            for col in role_cols:
                role_name = re.sub(r"\s+\d+$", "", col).strip()
                if not role_name:
                    continue
                roles.setdefault(role_name, None)
                for person in split_names(row.get(col) or ""):
                    people.setdefault(person, [])
                    assignments.append((match["id"], person, role_name))

    lines = [
        "-- Seed from spreadsheet snapshot (en curso / pausado / mantenimiento).",
        "BEGIN;",
    ]

    for name in roles:
        lines.append(
            f"INSERT INTO public.roles (id, name, always_on_duty) VALUES ({sql_str(uid('role', name))}, {sql_str(name)}, {'TRUE' if name in ALWAYS_ON else 'FALSE'});"
        )
    for name, role_list in people.items():
        lines.append(
            f"INSERT INTO public.people (id, display_name) VALUES ({sql_str(uid('person', name))}, {sql_str(name)});"
        )
        for role in role_list:
            if role not in roles:
                continue
            lines.append(
                f"INSERT INTO public.person_roles (person_id, role_id) VALUES ({sql_str(uid('person', name))}, {sql_str(uid('role', role))}) ON CONFLICT DO NOTHING;"
            )
    for name in tasks:
        color = TASK_COLORS.get(name, "#64748b")
        lines.append(
            f"INSERT INTO public.tasks (id, name, color) VALUES ({sql_str(uid('task', name))}, {sql_str(name)}, {sql_str(color)});"
        )
    for task, role in task_roles:
        lines.append(
            f"INSERT INTO public.task_roles (task_id, role_id) VALUES ({sql_str(uid('task', task))}, {sql_str(uid('role', role))}) ON CONFLICT DO NOTHING;"
        )
    for name, cid in clients.items():
        lines.append(
            f"INSERT INTO public.clients (id, name) VALUES ({sql_str(cid)}, {sql_str(name)});"
        )
    for code, proj in projects.items():
        lines.append(
            "INSERT INTO public.projects (id, code, client_id, ficha_url, kind, status) VALUES ("
            f"{sql_str(proj['id'])}, {sql_str(code)}, {sql_str(clients[proj['client']])}, "
            f"{sql_str(proj['ficha'])}, {sql_str(proj['kind'])}, {sql_str(proj['status'])});"
        )
    for ws in workstreams:
        proj_id = projects[ws["code"]]["id"]
        lines.append(
            "INSERT INTO public.workstreams (id, project_id, name, status) VALUES ("
            f"{sql_str(ws['id'])}, {sql_str(proj_id)}, {sql_str(ws['name'])}, {sql_str(ws['status'])});"
        )
        for week, cell_tasks in ws["weeks"]:
            tw_id = uid("tw", ws["id"], week)
            lines.append(
                f"INSERT INTO public.timeline_weeks (id, workstream_id, week_start) VALUES ({sql_str(tw_id)}, {sql_str(ws['id'])}, {sql_str(week)}) ON CONFLICT DO NOTHING;"
            )
            for tname in cell_tasks:
                lines.append(
                    f"INSERT INTO public.timeline_week_tasks (timeline_week_id, task_id) VALUES ({sql_str(tw_id)}, {sql_str(uid('task', tname))}) ON CONFLICT DO NOTHING;"
                )
    for ws_id, person, role in assignments:
        lines.append(
            "INSERT INTO public.assignments (id, workstream_id, person_id, role_id) VALUES ("
            f"{sql_str(uid('asg', ws_id, person, role))}, {sql_str(ws_id)}, {sql_str(uid('person', person))}, {sql_str(uid('role', role))}) ON CONFLICT DO NOTHING;"
        )

    lines.append("COMMIT;")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} ({len(lines)} statements)")
    print("people", len(people), "roles", len(roles), "tasks", len(tasks))
    print("clients", len(clients), "projects", len(projects), "workstreams", len(workstreams))
    print("assignments", len(assignments))


if __name__ == "__main__":
    main()
