"use client";

import { useState } from "react";
import { fieldControlClass } from "@/components/ui/Field";

const NEW = "__new__";

export function ClientSelect({
  clients,
  defaultClientId = "",
}: {
  clients: { id: string; name: string }[];
  defaultClientId?: string;
}) {
  const [value, setValue] = useState(defaultClientId);
  const isNew = value === NEW;

  return (
    <span className="block space-y-2">
      <select
        name="client_id"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        required={!isNew}
        className={fieldControlClass}
      >
        <option value="">Elegir cliente</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
        <option value={NEW}>+ Nuevo cliente</option>
      </select>
      {isNew ? (
        <input
          name="new_client_name"
          required
          placeholder="Nombre del nuevo cliente"
          className={fieldControlClass}
        />
      ) : null}
    </span>
  );
}
