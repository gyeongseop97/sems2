"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./users.module.css";

type Role = "admin" | "manager" | "editor" | "viewer";

type Organization = {
  id: string;
  name: string;
  active: boolean;
};

type Site = {
  id: string;
  name: string;
  organization_id: string;
  active: boolean;
};

type Profile = {
  id: string;
  email: string | null;
  display_name: string;
  department: string;
  role: Role;
  active: boolean;
  organization_id: string | null;
  site_id: string | null;
  organization?: { name: string } | null;
  site?: { name: string } | null;
};

type UserResponse = {
  profiles: Profile[];
  organizations: Organization[];
  sites: Site[];
  error?: string;
};

const roleLabels: Record<Role, string> = {
  admin: "시스템 관리자",
  manager: "기획실 관리자",
  editor: "자료 입력자",
  viewer: "조회자",
};

export default function UserManagementPage() {
  const supabase = getSupabaseBrowserClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    displayName: "",
    department: "",
    role: "editor" as Role,
    organizationId: "",
    siteId: "",
  });

  const request = async (url: string, init?: RequestInit) => {
    if (!supabase) throw new Error("Supabase 연결 정보가 없습니다.");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("로그인 세션이 없습니다.");

    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "요청을 처리하지 못했습니다.");
    return payload;
  };

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await request("/api/admin/users") as UserResponse;
      setProfiles(payload.profiles ?? []);
      setOrganizations(payload.organizations ?? []);
      setSites(payload.sites ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "사용자 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const formSites = useMemo(
    () => sites.filter((site) => site.active && site.organization_id === form.organizationId),
    [form.organizationId, sites],
  );

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setError("");
    setSuccess("");
    try {
      await request("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          displayName: form.displayName,
          department: form.department,
          role: form.role,
          organizationId: form.organizationId || null,
          siteId: form.siteId || null,
          active: true,
        }),
      });
      setSuccess(`${form.displayName} 계정을 생성했습니다.`);
      setForm({ email: "", password: "", displayName: "", department: "", role: "editor", organizationId: "", siteId: "" });
      await loadUsers();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "계정을 생성하지 못했습니다.");
    } finally {
      setCreating(false);
    }
  };

  const updateLocal = (id: string, patch: Partial<Profile>) => {
    setProfiles((current) => current.map((profile) => profile.id === id ? { ...profile, ...patch } : profile));
  };

  const saveProfile = async (profile: Profile) => {
    setSavingId(profile.id);
    setError("");
    setSuccess("");
    try {
      await request("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({
          id: profile.id,
          displayName: profile.display_name,
          department: profile.department,
          role: profile.role,
          organizationId: profile.organization_id,
          siteId: profile.site_id,
          active: profile.active,
        }),
      });
      setSuccess(`${profile.display_name} 계정 정보를 저장했습니다.`);
      await loadUsers();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "사용자 정보를 저장하지 못했습니다.");
    } finally {
      setSavingId("");
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>SYSTEM ADMINISTRATION</div>
            <h1>사용자 및 권한 관리</h1>
            <p>SEMS 계정을 생성하고 법인·사업장별 접근 권한을 관리합니다.</p>
          </div>
          <a className={styles.back} href="/">SEMS로 돌아가기</a>
        </header>

        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>신규 사용자 등록</h2>
            <p>회원가입은 개방하지 않고 관리자가 필요한 계정만 직접 생성합니다.</p>
          </div>
          <form onSubmit={createUser}>
            <div className={styles.formGrid}>
              <label className={styles.field}>이름
                <input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} required />
              </label>
              <label className={styles.field}>이메일
                <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
              </label>
              <label className={styles.field}>초기 비밀번호
                <input type="password" minLength={8} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required />
              </label>
              <label className={styles.field}>부서
                <input value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))} />
              </label>
              <label className={styles.field}>권한
                <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as Role }))}>
                  {(Object.keys(roleLabels) as Role[]).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                </select>
              </label>
              <label className={styles.field}>소속 법인
                <select value={form.organizationId} onChange={(event) => setForm((current) => ({ ...current, organizationId: event.target.value, siteId: "" }))}>
                  <option value="">전체 또는 미지정</option>
                  {organizations.filter((organization) => organization.active).map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                </select>
              </label>
              <label className={styles.field}>소속 사업장
                <select value={form.siteId} onChange={(event) => setForm((current) => ({ ...current, siteId: event.target.value }))} disabled={!form.organizationId}>
                  <option value="">전체 또는 미지정</option>
                  {formSites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
                </select>
              </label>
            </div>
            <div className={styles.actions}>
              <button className={styles.primary} type="submit" disabled={creating}>{creating ? "계정 생성 중..." : "사용자 등록"}</button>
            </div>
          </form>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>등록 사용자</h2>
            <p>권한 또는 사용 상태를 변경한 후 행 오른쪽의 저장 버튼을 눌러 주세요.</p>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>사용자</th>
                  <th>부서</th>
                  <th>권한</th>
                  <th>법인</th>
                  <th>사업장</th>
                  <th>사용 상태</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!loading && profiles.length === 0 && <tr><td className={styles.empty} colSpan={7}>등록된 사용자가 없습니다.</td></tr>}
                {loading && <tr><td className={styles.empty} colSpan={7}>사용자 목록을 불러오고 있습니다.</td></tr>}
                {profiles.map((profile) => {
                  const availableSites = sites.filter((site) => site.active && site.organization_id === profile.organization_id);
                  return (
                    <tr key={profile.id}>
                      <td><div className={styles.name}><strong>{profile.display_name || "이름 미등록"}</strong><span>{profile.email}</span></div></td>
                      <td>{profile.department || "-"}</td>
                      <td>
                        <select className={styles.inlineSelect} value={profile.role} onChange={(event) => updateLocal(profile.id, { role: event.target.value as Role })}>
                          {(Object.keys(roleLabels) as Role[]).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className={styles.inlineSelect} value={profile.organization_id ?? ""} onChange={(event) => updateLocal(profile.id, { organization_id: event.target.value || null, site_id: null })}>
                          <option value="">전체 또는 미지정</option>
                          {organizations.filter((organization) => organization.active).map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className={styles.inlineSelect} value={profile.site_id ?? ""} onChange={(event) => updateLocal(profile.id, { site_id: event.target.value || null })} disabled={!profile.organization_id}>
                          <option value="">전체 또는 미지정</option>
                          {availableSites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <label className={styles.toggle}><input type="checkbox" checked={profile.active} onChange={(event) => updateLocal(profile.id, { active: event.target.checked })} />{profile.active ? "사용" : "중지"}</label>
                      </td>
                      <td><button className={styles.save} type="button" disabled={savingId === profile.id} onClick={() => saveProfile(profile)}>{savingId === profile.id ? "저장 중" : "저장"}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
