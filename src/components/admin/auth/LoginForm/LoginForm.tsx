"use client"

import React, { useEffect, useState } from 'react'
import { useActionState } from 'react'
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { loginUserAction } from "@/lib/actions/authActions"
import { useRouter } from "next/navigation"
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import type { AuthActionResponse } from '@/types/actions'
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
})

type LoginFormValues = z.infer<typeof formSchema>

const initialState: AuthActionResponse = {
    success: false,
    message: undefined,
    error: undefined,
};

export function AdminLoginForm() {
  const [state, formAction, isPending] = useActionState(loginUserAction, initialState)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  })

  useEffect(() => {
    if (state?.success === true) {
      router.push('/admin/dashboard');
      
      
    } else if (state?.success === false) {
        if (state.error) {
             toast.error(state.error);
        }
    }
  }, [state, form, router]) 

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl text-center">Admin Login</CardTitle>
          <CardDescription className="text-center">Enter your credentials to access the admin panel</CardDescription>
        </CardHeader>
        
        <Form {...form}>
            
            <form action={formAction} className="space-y-6 px-6 pb-6">
                
                
                
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <Label htmlFor="email">Email</Label>
                            <FormControl>
                                <Input id="email" type="email" placeholder="admin@example.com" {...field} />
                            </FormControl>
                            
                            <FormMessage /> 
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                             <div className="flex items-center justify-between">
                                <Label htmlFor="password">Password</Label>
                                
                            </div>
                            <div className="relative">
                                <FormControl>
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        {...field} 
                                        className="pr-10"
                                    />
                                </FormControl>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                            
                            <FormMessage />
                        </FormItem>
                    )}
                 />

                <Button type="submit" disabled={isPending} className="w-full">
                    {isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing In...</>
                    ) : (
                        'Sign In'
                    )}
                </Button>
                
            </form>
         </Form>
      </Card>
    </div>
  )
}
