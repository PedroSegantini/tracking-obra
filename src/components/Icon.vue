<script setup>
import { House, LayoutDashboard, ReceiptText, Settings, UserRound, UsersRound, Plus, ArrowUpRight, ArrowDownLeft, Wallet, CreditCard, Moon, Sun, LogOut, ChevronRight, X, Menu, Download, Upload, Search, Pencil, Trash2, Check, CircleAlert, HardHat, ArrowRight, ArrowLeft, Link, LoaderCircle, FileSpreadsheet, Eye, EyeOff } from '@lucide/vue'
defineProps({ name: { type: String, default: 'house' }, size: { type: Number, default: 20 } })
const icons = { house: House, dashboard: LayoutDashboard, expenses: ReceiptText, settings: Settings, user: UserRound, users: UsersRound, plus: Plus, up: ArrowUpRight, down: ArrowDownLeft, wallet: Wallet, credit: CreditCard, moon: Moon, sun: Sun, logout: LogOut, chevron: ChevronRight, x: X, menu: Menu, download: Download, upload: Upload, search: Search, edit: Pencil, trash: Trash2, check: Check, alert: CircleAlert, helmet: HardHat, arrow: ArrowRight, back: ArrowLeft, link: Link, loading: LoaderCircle, excel: FileSpreadsheet, eye: Eye, hidden: EyeOff }
</script>
<template><component :is="icons[name] || House" :size="size" :stroke-width="1.8" aria-hidden="true" /></template>
