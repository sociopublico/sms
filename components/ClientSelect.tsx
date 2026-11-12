"use client";

import { fieldControlClass } from "@/components/ui/Field";

const NEW = "__new__";

export function ClientSelect({
  clients,
  value,
  onChange,
  newClientName = "",
  onNewClientNameChange,
}: {
  clients: { id: string; name: string }[];
  value: string;
  onChange: (value: string) => void;
  newClientName?: string;
  onNewClientNameChange?: (value: string) => void;
}) {
  const isNew = value === NEW;

  return (
    <span className="block space-y-2">
      <select
        name="client_id"
        value={value}
        onChange={(event) => onChange(event.target.value)}
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
          value={newClientName}
          onChange={(event) => onNewClientNameChange?.(event.target.value)}
          placeholder="Nombre del nuevo cliente"
          className={fieldControlClass}
        />
      ) : null}
    </span>
  );
}
