package com.example.ui.components

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.R
import com.example.ui.theme.ArnEmeraldPrimary

@Composable
fun ArnAboutDialog(
    isOpen: Boolean,
    onDismiss: () -> Unit
) {
    if (!isOpen) return
    val context = LocalContext.current

    Dialog(
        onDismissRequest = onDismiss,
        properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            shape = RoundedCornerShape(28.dp),
            color = Color(0xFF0F172A),
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .widthIn(max = 440.dp)
                .padding(vertical = 16.dp)
                .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(28.dp))
        ) {
            Column(
                modifier = Modifier
                    .padding(24.dp)
                    .fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Official 3D ARN Logo
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF1E293B)),
                    contentAlignment = Alignment.Center
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.ic_arn_logo_3d),
                        contentDescription = "ARN Stream 3D Logo",
                        modifier = Modifier.size(64.dp)
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Platform name
                Text(
                    text = "ARN Stream",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black,
                    color = Color.White
                )

                Text(
                    text = "الإصدار 1.0.0 (2026)",
                    fontSize = 12.sp,
                    color = Color(0xFF64748B)
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Developer's name in official ARN Emerald color
                Text(
                    text = "تطوير وبرمجة: عبده رجب نصار",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = ArnEmeraldPrimary,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(6.dp))

                // Copyright notice
                Text(
                    text = "حقوق النشر (c) 2026 لشركة ARN Technology.\nجميع الحقوق محفوظة.",
                    fontSize = 12.sp,
                    color = Color(0xFF94A3B8),
                    textAlign = TextAlign.Center,
                    lineHeight = 18.sp
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Circular social buttons row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    SocialCircularButton(
                        iconRes = R.drawable.ic_social_whatsapp,
                        contentDescription = "WhatsApp",
                        onClick = { openUrl(context, "https://wa.me/201556710314") }
                    )
                    SocialCircularButton(
                        iconRes = R.drawable.ic_social_telegram,
                        contentDescription = "Telegram",
                        onClick = { openUrl(context, "https://t.me/ABDOURNASSAR95") }
                    )
                    SocialCircularButton(
                        iconRes = R.drawable.ic_social_facebook,
                        contentDescription = "Facebook",
                        onClick = { openUrl(context, "https://www.facebook.com/abdouragab.nassar") }
                    )
                    SocialCircularButton(
                        iconRes = R.drawable.ic_social_messenger,
                        contentDescription = "Messenger",
                        onClick = { openUrl(context, "https://m.me/abdouragab.nassar") }
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Glass close button
                Button(
                    onClick = onDismiss,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0x1AFFFFFF)),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(44.dp)
                ) {
                    Text(text = "إغلاق", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun SocialCircularButton(
    iconRes: Int,
    contentDescription: String,
    onClick: () -> Unit
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val bgColor = if (isPressed) Color(0xFF1E293B) else Color(0x14FFFFFF)

    Box(
        modifier = Modifier
            .size(50.dp)
            .clip(CircleShape)
            .background(bgColor)
            .border(1.dp, Color(0x26FFFFFF), CircleShape)
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            painter = painterResource(id = iconRes),
            contentDescription = contentDescription,
            tint = Color.Unspecified,
            modifier = Modifier.size(26.dp)
        )
    }
}

private fun openUrl(context: Context, url: String) {
    try {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(intent)
    } catch (_: Exception) {}
}
