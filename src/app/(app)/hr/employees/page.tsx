"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, Phone, Clock, DollarSign, UserCheck, TrendingUp, Search } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import toast from "react-hot-toast";

type Employee = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  workMode: string;
  salary: string | null;
  avatarSignedUrl: string | null;
  memberSince: string;
  metrics: {
    punctuality: number;
    completedTasks: number;
    totalTasks: number;
  };
};

export default function EmployeeManagementPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Salary Modal
  const [salaryModalEmp, setSalaryModalEmp] = useState<Employee | null>(null);
  const [proposedSalary, setProposedSalary] = useState("");
  const [submittingSalary, setSubmittingSalary] = useState(false);

  useEffect(() => {
    fetch("/api/hr/employees")
      .then((r) => r.json())
      .then((data) => {
        if (data.data) setEmployees(data.data);
      })
      .catch(() => toast.error("Failed to load employees"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSalarySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!salaryModalEmp || !proposedSalary.trim()) return;

    setSubmittingSalary(true);
    try {
      const res = await fetch(`/api/hr/employees/${salaryModalEmp.id}/salary-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposedSalary }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to request salary update");

      if (data.autoApproved) {
        toast.success("Salary updated successfully");
        setEmployees(prev => prev.map(emp => emp.id === salaryModalEmp.id ? { ...emp, salary: proposedSalary } : emp));
      } else {
        toast.success("Salary request sent to Admins");
      }
      setSalaryModalEmp(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmittingSalary(false);
    }
  }

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-base-content">Employee Management</h1>
          <p className="text-sm text-base-content/60">Overview of all active employees and performance metrics</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
          <input 
            type="text" 
            placeholder="Search employees..." 
            className="input input-bordered input-sm w-full pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredEmployees.map(emp => (
          <div key={emp.id} className="card bg-base-200 shadow-sm hover:shadow-md transition-shadow border border-base-300">
            <div className="card-body p-5 gap-4">
              <div className="flex items-start gap-3">
                <div className="avatar">
                  <UserAvatar 
                    user={{ name: emp.name, profilePicUrl: emp.avatarSignedUrl }} 
                    size={48} 
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-base-content truncate" title={emp.name}>{emp.name}</h3>
                  <p className="text-xs text-base-content/60 truncate">{emp.role.replace(/_/g, " ")}</p>
                  <div className="badge badge-outline badge-xs mt-1">{emp.workMode}</div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-base-content/70">
                  <Mail className="w-3.5 h-3.5" />
                  <span className="truncate">{emp.email}</span>
                </div>
                {emp.phone && (
                  <div className="flex items-center gap-2 text-base-content/70">
                    <Phone className="w-3.5 h-3.5" />
                    <span className="truncate">{emp.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-base-content/70">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>{emp.salary ? emp.salary : "Not set"}</span>
                  <button 
                    className="btn btn-xs btn-ghost text-primary ml-auto"
                    onClick={() => {
                      setProposedSalary(emp.salary || "");
                      setSalaryModalEmp(emp);
                    }}
                  >
                    Update
                  </button>
                </div>
              </div>

              <div className="divider my-0 opacity-50"></div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-base-100 p-2 rounded-lg text-center border border-base-300">
                  <div className="flex items-center justify-center gap-1 text-xs text-base-content/60 mb-1">
                    <Clock className="w-3 h-3" /> Punctuality
                  </div>
                  <div className={`font-semibold ${emp.metrics.punctuality >= 90 ? 'text-success' : emp.metrics.punctuality >= 75 ? 'text-warning' : 'text-error'}`}>
                    {emp.metrics.punctuality}%
                  </div>
                </div>
                <div className="bg-base-100 p-2 rounded-lg text-center border border-base-300">
                  <div className="flex items-center justify-center gap-1 text-xs text-base-content/60 mb-1">
                    <CheckCircle className="w-3 h-3" /> Tasks
                  </div>
                  <div className="font-semibold text-info">
                    {emp.metrics.completedTasks} <span className="text-xs text-base-content/40 font-normal">/ {emp.metrics.totalTasks}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        {filteredEmployees.length === 0 && (
          <div className="col-span-full py-12 text-center text-base-content/50 bg-base-200 rounded-xl border border-base-300 border-dashed">
            <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No employees found matching your search.</p>
          </div>
        )}
      </div>

      {/* Salary Modal */}
      {salaryModalEmp && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Update Salary: {salaryModalEmp.name}</h3>
            <form onSubmit={(e) => void handleSalarySubmit(e)} className="space-y-4">
              <div className="form-control">
                <label className="label"><span className="label-text">Current Salary</span></label>
                <input type="text" className="input input-bordered" value={salaryModalEmp.salary || "Not set"} disabled />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Proposed Salary</span></label>
                <input 
                  type="text" 
                  className="input input-bordered" 
                  placeholder="e.g. $5,000/mo"
                  value={proposedSalary}
                  onChange={(e) => setProposedSalary(e.target.value)}
                  required
                  autoFocus
                />
                <label className="label"><span className="label-text-alt text-base-content/60">Depending on your role, this will either apply directly or create an approval request for Admins.</span></label>
              </div>
              <div className="modal-action">
                <button type="button" className="btn btn-ghost" onClick={() => setSalaryModalEmp(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submittingSalary}>
                  {submittingSalary && <span className="loading loading-spinner loading-xs" />}
                  Submit
                </button>
              </div>
            </form>
          </div>
          <div className="modal-backdrop" onClick={() => setSalaryModalEmp(null)}></div>
        </div>
      )}
    </div>
  );
}

// Custom icon since CheckCircle isn't imported
function CheckCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
