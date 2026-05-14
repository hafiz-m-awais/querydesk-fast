import { BookOpen, Send, Eye, Bell, Shield, Users, Clock, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react'

const sections = [
  {
    icon: Users,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    title: 'User Roles',
    items: [
      { name: 'Student', desc: 'Submit queries for attendance, marks, assignments, projects, and finals. Track your query status in real-time.' },
      { name: 'Teaching Assistant (TA)', desc: 'View and update queries for courses you assist. Can change status and add notes.' },
      { name: 'Instructor', desc: 'Manage queries for your assigned courses. Resolve or escalate queries with notes.' },
      { name: 'Coordinator', desc: 'Oversee all queries in your department. Can manage courses and reassign queries.' },
      { name: 'Head of Department (HoD)', desc: 'Full dashboard with SLA monitoring, query statistics, and escalation management.' },
      { name: 'Super Admin', desc: 'All HoD capabilities plus system-wide access across all departments and campuses.' },
    ],
  },
  {
    icon: Send,
    color: 'text-green-600',
    bg: 'bg-green-50',
    title: 'Submitting a Query (Students)',
    items: [
      { name: 'Step 1 — Select Course', desc: 'Choose the course related to your query from the dropdown. Only courses in your department are shown.' },
      { name: 'Step 2 — Choose Query Type', desc: 'Select: Attendance, Marks, Assignment, Project, Final Exam, or Other.' },
      { name: 'Step 3 — Fill Details', desc: 'Attendance: session number + date required. Marks: marks awarded vs expected. Add a clear description (10–2000 chars).' },
      { name: 'Step 4 — Attach Evidence', desc: 'Optionally attach a screenshot, PDF, or image (max 5 MB) as supporting evidence.' },
      { name: 'Step 5 — Submit', desc: 'You\'ll receive a reference ID (e.g. QD-A1B2C3D4-2605). Use this to track your query.' },
    ],
  },
  {
    icon: Eye,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    title: 'Query Status Lifecycle',
    items: [
      { name: 'Pending', desc: 'Query submitted and waiting for the instructor/TA to review.' },
      { name: 'Reviewing', desc: 'Staff is currently investigating your query.' },
      { name: 'Resolved', desc: 'Query has been addressed. Check instructor notes for the outcome.' },
      { name: 'Rejected', desc: 'Query was not accepted. Instructor notes will explain the reason.' },
      { name: 'Escalated', desc: 'Query has been forwarded to HoD for further review.' },
    ],
  },
  {
    icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    title: 'SLA (Response Time) Policy',
    items: [
      { name: 'Attendance Queries', desc: '24-hour response window. Auto-escalated to HoD if breached.' },
      { name: 'Marks Queries', desc: '48-hour response window. Auto-escalated to HoD if breached.' },
      { name: 'Assignment / Project', desc: '48–72 hour response window.' },
      { name: 'Final Exam', desc: '24-hour response window — highest priority.' },
      { name: 'SLA Breach', desc: 'If staff does not respond within the SLA window, the query is flagged as "SLA Breached" and visible to HoD.' },
    ],
  },
  {
    icon: Bell,
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    title: 'Notifications',
    items: [
      { name: 'Bell Icon', desc: 'The bell icon in the navbar shows your unread notification count.' },
      { name: 'Status Updates', desc: 'You\'ll be notified whenever your query status changes.' },
      { name: 'Escalation Alerts', desc: 'HoD and coordinators are notified when SLA is breached or a query is escalated.' },
    ],
  },
  {
    icon: Shield,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    title: 'For Staff (Instructor / TA)',
    items: [
      { name: 'Dashboard', desc: 'Go to Dashboard to see all queries for your assigned courses, sorted by submission date.' },
      { name: 'Update Status', desc: 'Click any query row to open the detail sheet. Change the status and add notes.' },
      { name: 'Add Notes', desc: 'Always add instructor notes when resolving or rejecting — students can see them.' },
      { name: 'Bulk Actions', desc: 'Select multiple queries using the checkbox column and bulk-update their status.' },
    ],
  },
]

export default function GuidePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="bg-white border rounded-xl p-6 flex gap-4 items-start shadow-sm">
        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
          <BookOpen className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">QueryDesk — User Guide</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Complete reference for students and staff at FAST-NUCES. Learn how to submit, track, and resolve academic queries.
          </p>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { icon: Send,         label: 'Submit a Query',     href: '/submit' },
          { icon: Eye,          label: 'My Queries',         href: '/my-queries' },
          { icon: HelpCircle,   label: 'Track by Reference', href: '/track' },
        ].map(({ icon: Icon, label, href }) => (
          <a
            key={href}
            href={href}
            className="flex items-center gap-3 bg-white border rounded-xl p-4 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
          >
            <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-sm font-medium text-foreground">{label}</span>
          </a>
        ))}
      </div>

      {/* Sections */}
      {sections.map(({ icon: Icon, color, bg, title, items }) => (
        <div key={title} className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b">
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <h2 className="font-semibold text-foreground">{title}</h2>
          </div>
          <div className="divide-y">
            {items.map(({ name, desc }) => (
              <div key={name} className="px-5 py-3.5 flex gap-4">
                <div className="shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{name}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Contact */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-sm text-foreground">Need further help?</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Contact your course coordinator or department office. For technical issues with the system, reach out to the IT helpdesk.
          </p>
        </div>
      </div>
    </div>
  )
}
