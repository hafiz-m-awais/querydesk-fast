'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ROLL_NUMBER_RE } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { apiFetch } from '@/lib/api'
import type { Campus, Department, Profile } from '@/types'

const schema = z.object({
  full_name:     z.string().min(2, 'Name must be at least 2 characters'),
  roll_number:   z.string().regex(ROLL_NUMBER_RE, 'Format: 23I-1234'),
  batch_year:    z.coerce.number().min(2000).max(new Date().getFullYear()),
  campus_id:     z.string().uuid('Select a campus'),
  department_id: z.string().uuid('Select a department'),
})

type FormValues = z.infer<typeof schema>

interface ProfileFormProps {
  profile:     Profile
  campuses:    Campus[]
  departments: Department[]
}

export default function ProfileForm({ profile, campuses, departments }: ProfileFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name:     profile.full_name ?? '',
      roll_number:   profile.roll_number ?? '',
      batch_year:    profile.batch_year ?? new Date().getFullYear(),
      campus_id:     profile.campus_id ?? '',
      department_id: profile.department_id ?? '',
    },
  })

  const selectedCampus = watch('campus_id')
  const filteredDepts  = departments.filter(d => d.campus_id === selectedCampus)

  // Reset department when campus changes (only if current dept not in new campus)
  useEffect(() => {
    const dep = departments.find(d => d.id === watch('department_id'))
    if (dep && dep.campus_id !== selectedCampus) {
      setValue('department_id', '')
    }
  }, [selectedCampus, departments, setValue, watch])

  const onSubmit = handleSubmit(async (data) => {
    setSaving(true)
    setError(null)
    try {
      await apiFetch('/profile', { method: 'PATCH', body: data })
      router.push('/')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  })

  return (
    <div className="flex min-h-[60vh] items-center justify-center py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Complete Your Profile</CardTitle>
          <CardDescription>
            Please fill in your details before using QueryDesk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" {...register('full_name')} placeholder="Muhammad Ali" />
              {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="roll_number">Roll Number</Label>
              <Input id="roll_number" {...register('roll_number')} placeholder="23I-1234" />
              {errors.roll_number && <p className="text-xs text-destructive">{errors.roll_number.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="batch_year">Batch Year</Label>
              <Input id="batch_year" type="number" {...register('batch_year')} placeholder={String(new Date().getFullYear())} />
              {errors.batch_year && <p className="text-xs text-destructive">{errors.batch_year.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Campus</Label>
              <Select
                value={watch('campus_id')}
                onValueChange={v => setValue('campus_id', v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select campus" />
                </SelectTrigger>
                <SelectContent>
                  {campuses.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.campus_id && <p className="text-xs text-destructive">{errors.campus_id.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select
                value={watch('department_id')}
                onValueChange={v => setValue('department_id', v, { shouldValidate: true })}
                disabled={!selectedCampus}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedCampus ? 'Select department' : 'Select campus first'} />
                </SelectTrigger>
                <SelectContent>
                  {filteredDepts.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name} ({d.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.department_id && <p className="text-xs text-destructive">{errors.department_id.message}</p>}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Saving…' : 'Save Profile'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
