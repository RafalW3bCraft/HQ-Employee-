package com.webcraft.employee.presentation.billing

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.webcraft.employee.domain.model.CreditPackage
import com.webcraft.employee.domain.model.PurchaseState
import com.webcraft.employee.presentation.theme.CyanAccent
import com.webcraft.employee.presentation.theme.DarkSurface
import com.webcraft.employee.presentation.theme.DarkSurfaceVariant
import com.webcraft.employee.presentation.theme.DarkTextPrimary
import com.webcraft.employee.presentation.theme.DarkTextSecondary
import com.webcraft.employee.presentation.theme.EmeraldSuccess
import com.webcraft.employee.presentation.theme.IndigoPrimary

@Composable
fun BillingScreen(
    viewModel: BillingViewModel
) {
    val state by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.userMessage) {
        state.userMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearMessage()
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Text(
                    text = "Monetization & Call Credits",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = DarkTextPrimary
                )
                Text(
                    text = "Powered by RevenueCat In-App Purchases and Authoritative Ledger",
                    style = MaterialTheme.typography.bodySmall,
                    color = DarkTextSecondary
                )
            }

            // Wallet Summary Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = DarkSurface)
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Authoritative Wallet Balance",
                                style = MaterialTheme.typography.titleSmall,
                                color = DarkTextSecondary
                            )
                            Icon(
                                imageVector = Icons.Default.CreditCard,
                                contentDescription = "Wallet",
                                tint = CyanAccent
                            )
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Available",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = DarkTextSecondary
                                )
                                Text(
                                    text = "${state.wallet?.available ?: 0} Credits",
                                    style = MaterialTheme.typography.headlineMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = EmeraldSuccess
                                )
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Reserved (In-Flight)",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = DarkTextSecondary
                                )
                                Text(
                                    text = "${state.wallet?.reserved ?: 0} Credits",
                                    style = MaterialTheme.typography.headlineMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = DarkTextPrimary
                                )
                            }
                        }
                    }
                }
            }

            item {
                Text(
                    text = "Available Credit Packages",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = DarkTextPrimary
                )
            }

            items(state.packages) { pkg ->
                PackageCard(
                    pkg = pkg,
                    isPurchasing = state.purchaseState is PurchaseState.Purchasing &&
                            (state.purchaseState as PurchaseState.Purchasing).packageId == pkg.id,
                    onPurchase = { viewModel.purchase(pkg.id) }
                )
            }

            item {
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedButton(
                    onClick = { viewModel.restorePurchases() },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = CyanAccent)
                ) {
                    Icon(imageVector = Icons.Default.Refresh, contentDescription = "Restore")
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(text = "Restore Previous Purchases")
                }
            }
        }

        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier.align(Alignment.BottomCenter)
        )
    }
}

@Composable
private fun PackageCard(
    pkg: CreditPackage,
    isPurchasing: Boolean,
    onPurchase: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = DarkSurface)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = pkg.displayName,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = DarkTextPrimary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(IndigoPrimary.copy(alpha = 0.2f))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "${pkg.credits} calls",
                            color = CyanAccent,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = pkg.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = DarkTextSecondary
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = pkg.price,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.ExtraBold,
                    color = EmeraldSuccess
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Button(
                onClick = onPurchase,
                enabled = !isPurchasing,
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary)
            ) {
                if (isPurchasing) {
                    CircularProgressIndicator(
                        color = Color.White,
                        modifier = Modifier.height(18.dp).width(18.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(text = "Buy", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
