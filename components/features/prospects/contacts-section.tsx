'use client';

import { api } from '@/components/providers';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  Loader2,
  Briefcase,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useState } from 'react';

type DiscoveryGuardrail = {
  code: string;
  title: string;
  message: string;
  recommendation?: string;
};

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle?: string | null;
  seniority?: string | null;
};

export function ContactsSection({
  prospectId,
  contacts,
  onContactCreated,
}: {
  prospectId: string;
  contacts?: Contact[];
  onContactCreated: () => void;
}) {
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactDiscoveryGuardrail, setContactDiscoveryGuardrail] =
    useState<DiscoveryGuardrail | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    jobTitle: '',
    primaryEmail: '',
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const discoverContacts = (api.contacts.discoverForCompany as any).useMutation(
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onSuccess: (data: any) => {
        setContactDiscoveryGuardrail(
          (data.guardrail as DiscoveryGuardrail | null) ?? null,
        );
        onContactCreated();
      },
    },
  );

  const createContact = api.contacts.create.useMutation({
    onSuccess: () => {
      setShowAddContact(false);
      setForm({ firstName: '', lastName: '', jobTitle: '', primaryEmail: '' });
      onContactCreated();
    },
  });

  const handleCreate = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) return;
    createContact.mutate({
      prospectId,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      ...(form.jobTitle.trim() && { jobTitle: form.jobTitle.trim() }),
      ...(form.primaryEmail.trim() && {
        primaryEmail: form.primaryEmail.trim(),
      }),
    });
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
          Contacts ({contacts?.length ?? 0})
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddContact(!showAddContact)}
            className="ui-tap flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-500 hover:text-[#040026] hover:bg-slate-100 transition-all border border-slate-100"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add Contact
          </button>
          <button
            onClick={() => {
              setContactDiscoveryGuardrail(null);
              discoverContacts.mutate({ prospectId });
            }}
            disabled={discoverContacts.isPending}
            className="ui-tap flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-500 hover:text-[#040026] hover:bg-slate-100 transition-all border border-slate-100 disabled:opacity-50"
          >
            {discoverContacts.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Discovering...
              </>
            ) : (
              <>
                <Users className="w-3.5 h-3.5" /> Discover Contacts
              </>
            )}
          </button>
        </div>
      </div>

      {showAddContact && (
        <div className="glass-card p-5 mb-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="First name *"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="input-minimal"
            />
            <input
              type="text"
              placeholder="Last name *"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="input-minimal"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Job title"
              value={form.jobTitle}
              onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
              className="input-minimal"
            />
            <input
              type="email"
              placeholder="Email"
              value={form.primaryEmail}
              onChange={(e) =>
                setForm({ ...form, primaryEmail: e.target.value })
              }
              className="input-minimal"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={
                createContact.isPending ||
                !form.firstName.trim() ||
                !form.lastName.trim()
              }
              className="ui-tap px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#040026] text-white hover:bg-[#040026]/90 transition-all disabled:opacity-50"
            >
              {createContact.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                'Save'
              )}
            </button>
            <button
              onClick={() => setShowAddContact(false)}
              className="ui-tap p-2 rounded-xl text-slate-400 hover:text-slate-600 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {contactDiscoveryGuardrail && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-black text-amber-900">
                {contactDiscoveryGuardrail.title}
              </p>
              <p className="text-xs font-bold text-amber-800 mt-1">
                {contactDiscoveryGuardrail.message}
              </p>
              {contactDiscoveryGuardrail.recommendation && (
                <p className="text-xs font-semibold text-amber-700 mt-2">
                  {contactDiscoveryGuardrail.recommendation}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {contacts && contacts.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {contacts.map((contact) => (
            <Link
              key={contact.id}
              href={`/admin/contacts/${contact.id}`}
              className="glass-card glass-card-hover ui-focus px-4 py-3 flex items-center gap-3 shrink-0"
            >
              <div className="w-9 h-9 rounded-full bg-klarifai-indigo/10 flex items-center justify-center">
                <span className="text-xs font-semibold text-klarifai-indigo">
                  {contact.firstName?.[0]}
                  {contact.lastName?.[0]}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-klarifai-midnight truncate">
                  {contact.firstName} {contact.lastName}
                </p>
                {contact.jobTitle && (
                  <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                    <Briefcase className="w-3 h-3 shrink-0" />
                    {contact.jobTitle}
                  </p>
                )}
              </div>
              {contact.seniority && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0">
                  {contact.seniority}
                </span>
              )}
            </Link>
          ))}
        </div>
      ) : !showAddContact ? (
        <p className="text-xs text-slate-300 italic">
          No contacts yet — use the buttons above to add or discover.
        </p>
      ) : null}
    </section>
  );
}
